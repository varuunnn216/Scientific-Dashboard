import styles from './ShinyText.module.css';

interface ShinyTextProps {
  text: string;
  className?: string;
}

export default function ShinyText({ text, className = '' }: ShinyTextProps) {
  return <span className={`${styles.shiny} ${className}`}>{text}</span>;
}
