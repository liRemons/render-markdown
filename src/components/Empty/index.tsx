import style from './index.module.less';

interface MyEmptyProps {
  description?: string;
}

export default function MyEmpty({ description = '暂无数据' }: MyEmptyProps) {
  return (
    <div className={style.empty_container}>
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
        <rect x="8" y="16" width="48" height="36" rx="4" stroke="#d9d9d9" strokeWidth="2"/>
        <line x1="16" y1="28" x2="48" y2="28" stroke="#d9d9d9" strokeWidth="2"/>
        <line x1="16" y1="36" x2="40" y2="36" stroke="#d9d9d9" strokeWidth="2"/>
        <line x1="16" y1="44" x2="32" y2="44" stroke="#d9d9d9" strokeWidth="2"/>
      </svg>
      <span className={style.description}>{description}</span>
    </div>
  );
}
