import {fileURLToPath} from 'node:url'
import path from 'node:path'
export default {content:[fileURLToPath(new URL('./index.html',import.meta.url)),fileURLToPath(new URL('./src',import.meta.url)).split(path.sep).join('/')+'/**/*.{js,ts,jsx,tsx}'],theme:{extend:{colors:{cream:'#F7F1E8',ink:'#171717',orange:'#F47B35',mist:'#EAE5DE'},fontFamily:{sans:['Inter','ui-sans-serif','system-ui']}}},plugins:[]}
