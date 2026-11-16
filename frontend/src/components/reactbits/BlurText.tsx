import styles from './BlurText.module.css';

interface BlurTextProps {
  text: string;
  delayMs?: number;
  className?: string;
}

export default function BlurText({ text, delayMs = 45, className = '' }: BlurTextProps) {
  const words = text.split(' ');
  return (
    <span className={`${styles.wrapper} ${className}`}>
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          className={styles.word}
          style={{ animationDelay: `${index * delayMs}ms` }}
        >
          {word}
          {index < words.length - 1 ? '\u00A0' : ''}
        </span>
      ))}
    </span>
  );
}
