import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getMetaPixelId, trackMetaPageView } from '@/lib/metaPixel';

/**
 * SPA PageView for Meta Pixel (base script + init run from trackMetaPageView).
 */
export function MetaPixelPageViews() {
  const location = useLocation();

  useEffect(() => {
    if (!getMetaPixelId()) return;
    trackMetaPageView();
  }, [location.pathname, location.search]);

  return null;
}
