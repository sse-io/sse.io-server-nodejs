import { PORT, PATH } from './mock_data';

export function genEventSourceUrl(guid) {
  return `http://localhost:${PORT}/${PATH.replace(':guid', guid)}`;
}
