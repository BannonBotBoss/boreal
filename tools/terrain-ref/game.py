import numpy as np, json, sys
from metrics import metrics
b = open(sys.argv[1], 'rb').read(); n, cell = np.frombuffer(b[:8], np.int32); N = n * n
z = np.frombuffer(b[8:8 + 4 * N], np.float32).reshape(n, n); zf = np.frombuffer(b[8 + 4 * N:8 + 8 * N], np.float32).reshape(n, n); w = np.frombuffer(b[8 + 8 * N:8 + 9 * N], np.uint8).reshape(n, n).astype(bool)
surf = np.where(w, zf, z)  # water surface on water like the DSM
r, s = metrics(surf.astype(np.float64), w, float(cell)); print(json.dumps(r)); json.dump(r, open(sys.argv[2], 'w'), indent=1)
