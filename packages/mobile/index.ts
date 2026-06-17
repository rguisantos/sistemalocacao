import { registerRootComponent } from 'expo';
import { obterDb } from './src/db/database';
import { registrarBackgroundSync } from './src/sync/background';
import App from './App';

obterDb(); // abre/migra o banco local no boot
registrarBackgroundSync().catch(() => undefined); // sync automático a cada ~30 min
registerRootComponent(App);
