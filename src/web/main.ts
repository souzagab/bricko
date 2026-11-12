import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { initLocale } from './i18n/index.svelte.ts';

const target = document.getElementById('app');
if (!target) throw new Error('#app missing');
// The visitor's language is in place before anything is drawn: no flash of English first.
await initLocale();
export default mount(App, { target });
