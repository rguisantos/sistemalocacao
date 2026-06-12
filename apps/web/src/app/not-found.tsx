import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Não encontrado' };

export default function NotFound() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>404</h1>
        <p>Página não encontrada</p>
      </div>
    </div>
  );
}
