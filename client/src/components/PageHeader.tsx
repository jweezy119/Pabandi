import { Link } from 'react-router-dom';

type PageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  backTo?: string;
  actions?: React.ReactNode;
  className?: string;
};

export default function PageHeader({ title, description, eyebrow, backTo, actions, className = '' }: PageHeaderProps) {
  return (
    <section className={`relative overflow-hidden rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 sm:p-8 md:p-10 anim-fade-up ${className}`}>
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative">
        {backTo && (
          <Link to={backTo} className="text-primary text-sm font-bold anim-fade-up">
            ← Back
          </Link>
        )}
        {eyebrow && <p className="mt-3 text-xs font-bold uppercase tracking-widest text-primary/80">{eyebrow}</p>}
        <h1 className="mt-2 font-headline text-2xl sm:text-3xl md:text-4xl font-black">{title}</h1>
        {description && <p className="mt-2 text-sm sm:text-base text-on-surface-variant max-w-2xl">{description}</p>}
        {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </section>
  );
}
