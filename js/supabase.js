// js/supabase.js

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


export const toast = (msg, ms = 2600) => {

  const el = document.createElement('div');

  el.className = 'toast'; el.textContent = msg;

  document.body.appendChild(el); setTimeout(() => el.remove(), ms);

};
