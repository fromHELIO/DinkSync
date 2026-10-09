// The only file your components and context import from.
//
//   VITE_USE_MOCK_API=false  -> your Express API at VITE_API_BASE_URL
//   anything else, INCLUDING UNSET -> the browser-only fake
//
// Demo mode is the DEFAULT, so a fresh build works before anything is
// configured. Both modules are imported statically (top-level await does not
// build in Vite's default target) and one is chosen at run time.
 
import * as mockApi from './mockApi.js'
import * as httpApi from './httpApi.js'
 
// Force it to false when running on GitHub Pages (or use your own hostname check)
export const USING_MOCK_API = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' 
  ? false 
  : (import.meta.env.VITE_USE_MOCK_API !== 'false');
 
const implementation = USING_MOCK_API ? mockApi : httpApi
 
export const { fetchCourtAvailability, setBookmark } = implementation
 