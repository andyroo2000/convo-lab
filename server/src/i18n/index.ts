/* eslint-disable import/no-named-as-default-member */
import path from 'path';
import { fileURLToPath } from 'url';

import i18next from 'i18next';
import Backend from 'i18next-fs-backend';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

i18next.use(Backend).init({
  lng: 'en',
  fallbackLng: 'en',
  ns: ['email', 'server'],
  defaultNS: 'email',
  backend: {
    loadPath: path.join(__dirname, 'locales/{{lng}}/{{ns}}.json'),
  },
  interpolation: {
    escapeValue: false, // We'll handle HTML escaping in templates
  },
});

export default i18next;
