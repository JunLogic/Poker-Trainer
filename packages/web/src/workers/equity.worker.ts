import { expose } from 'comlink';
import { estimateEquity } from '@poker/engine';

// Exposed to the main thread via Comlink
expose({ estimateEquity });
