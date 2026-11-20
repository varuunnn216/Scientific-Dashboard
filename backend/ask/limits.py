import hashlib
import ipaddress
import os
import time
from functools import lru_cache

import redis

# Check and consume all counters atomically across workers. All keys share a
# Redis Cluster hash slot. Absolute window IDs let old keys expire naturally.
CONSUME = """
for i, key in ipairs(KEYS) do
    if tonumber(redis.call('GET', key) or '0') >= tonumber(ARGV[2 * i - 1]) then
        return 0
    end
end
for i, key in ipairs(KEYS) do
    if redis.call('INCR', key) == 1 then
        redis.call('EXPIRE', key, tonumber(ARGV[2 * i]))
    end
end
return 1
"""


def client_address(request):
    if os.getenv("VERCEL") == "1":
        # This header is overwritten by Vercel. Outside Vercel, only use an
        # operator-configured header from an explicitly trusted peer.
        raw = request.headers.get("x-vercel-forwarded-for", "")
    else:
        remote = request.client.host if request.client else ""
        header = os.getenv("ASK_PROXY_IP_HEADER")
        peers = {value.strip() for value in os.getenv("ASK_TRUSTED_PROXY_IPS", "").split(",")}
        raw = request.headers.get(header, "") if header and remote and remote in peers else remote
    try:
        address = ipaddress.ip_address(raw.strip())
        return str(address.ipv4_mapped or address) if address.version == 6 else str(address)
    except ValueError:
        return "unknown"


class Limits:
    def __init__(self, client):
        self.client = client
        scope = os.getenv("ASK_REDIS_NAMESPACE") or os.getenv("VERCEL_ENV") or "local"
        self.prefix = "{ask:" + scope + "}:"

    def allow(self, address):
        minute, day = int(time.time() // 60), int(time.time() // 86400)
        ip = hashlib.sha256(address.encode()).hexdigest()
        keys = [
            self.prefix + f"minute:{minute}:{ip}", self.prefix + f"day:{day}:{ip}",
            self.prefix + f"day:{day}:global",
        ]
        minute_cap = int(os.getenv("ASK_PER_IP_MINUTE") or "5")
        ip_cap = int(os.getenv("ASK_PER_IP_DAY") or "20")
        global_cap = int(os.getenv("ASK_GLOBAL_DAY") or "100")
        return self.client.eval(CONSUME, len(keys), *keys, minute_cap, 120, ip_cap, 172800, global_cap, 172800)

    def cache_key(self, question):
        return self.prefix + "result:v1:" + hashlib.sha256(question.encode()).hexdigest()

    def cached(self, question):
        return self.client.get(self.cache_key(question))

    def cache(self, question, value):
        self.client.setex(self.cache_key(question), 900, value)

    def get(self, provider):
        return self.client.exists(self.prefix + "cooldown:" + provider)

    def set(self, provider, ttl):
        self.client.setex(self.prefix + "cooldown:" + provider, ttl, "1")


@lru_cache(maxsize=1)
def get_limits():
    return Limits(redis.Redis.from_url(
        os.environ["ASK_REDIS_URL"], socket_timeout=2, socket_connect_timeout=2,
    ))
