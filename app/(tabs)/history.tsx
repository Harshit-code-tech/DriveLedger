import { Redirect } from 'expo-router';

/**
 * Backward-compatibility redirect:
 * History tab has been redesigned and renamed to Records.
 * Navigating to /(tabs)/history automatically redirects to /(tabs)/records.
 */
export default function HistoryRedirect() {
  return <Redirect href={'/(tabs)/records' as any} />;
}
