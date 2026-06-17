import { useStoreType } from './useStoreType'

/**
 * Backwards-compat shim. The original heuristic ("is the store name
 * food-shaped?") has been replaced by the real tenant-wide
 * <c>StoreType</c> flag from <c>useStoreType</c>. Existing call sites
 * keep working unchanged; new code should prefer <c>useStoreType</c>
 * directly so it can branch on Books / Apparel / Regular too.
 */
export function useIsFoodStore(): boolean {
  return useStoreType().isFood
}
