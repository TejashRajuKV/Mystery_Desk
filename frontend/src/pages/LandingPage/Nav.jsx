import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './Nav.css';

const LINKS = [
  { label: 'CASE', target: 'incident' },
  { label: 'HOW IT WORKS', target: 'assistant' },
  { label: 'ABOUT', target: 'cta' },
];

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

export default function Nav() {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > window.innerHeight * 0.6);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={solid ? 'l-nav l-nav--solid' : 'l-nav'}>
      <Link to="/" className="l-nav__brand l-mono" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
        MYSTERYDESK
      </Link>
      <div className="l-nav__links">
        {LINKS.map((l) => (
          <button key={l.label} type="button" className="l-nav__link l-mono" onClick={() => scrollToSection(l.target)}>
            {l.label}
          </button>
        ))}
      </div>
      <Link to="/dashboard" className="l-nav__cta l-mono">ENTER INVESTIGATION</Link>
    </nav>
  );
}
