import { PublicShell } from '../components/Shell.jsx';
import { Link } from '../lib/router.jsx';

export default function NotFound({ title = 'Page not found', message = "We couldn't find that page." }) {
  return (
    <PublicShell>
      <div className="auth center">
        <h1>{title}</h1>
        <p className="lead">{message}</p>
        <Link to="/" className="btn btn-ghost">Go home</Link>
      </div>
    </PublicShell>
  );
}
