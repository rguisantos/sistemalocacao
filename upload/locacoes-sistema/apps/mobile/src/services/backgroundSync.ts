import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { sincronizar } from './sync';

const TASK = 'sync-background';

TaskManager.defineTask(TASK, async () => {
  const r = await sincronizar();
  return r.ok
    ? BackgroundFetch.BackgroundFetchResult.NewData
    : BackgroundFetch.BackgroundFetchResult.Failed;
});

export async function registrarSyncBackground() {
  try {
    await BackgroundFetch.registerTaskAsync(TASK, {
      minimumInterval: 30 * 60, // 30 minutos
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (e) {
    console.warn('[backgroundSync] não registrado:', e);
  }
}
