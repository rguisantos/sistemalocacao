import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { sincronizar } from './sync-client';

const TAREFA_SYNC = 'sync-background';

TaskManager.defineTask(TAREFA_SYNC, async () => {
  try {
    await sincronizar();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/** Registra a sincronização automática a cada ~30 min (seção 6.1 da spec). */
export async function registrarBackgroundSync() {
  const status = await BackgroundFetch.getStatusAsync();
  if (status === BackgroundFetch.BackgroundFetchStatus.Restricted || status === BackgroundFetch.BackgroundFetchStatus.Denied) return;
  await BackgroundFetch.registerTaskAsync(TAREFA_SYNC, {
    minimumInterval: 30 * 60, // segundos
    stopOnTerminate: false,
    startOnBoot: true,
  });
}
