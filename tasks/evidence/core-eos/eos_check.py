"""Core EOS check (grokbot-1, Nov 3 2026). Cold Tillotson iron (data/earth/materials.json) vs hcp-iron Vinet
(Dewaele et al. 2006, PRL 97:215504: V0 = 22.428 A^3 per 2-atom cell, K0 = 163.4 GPa, K0' = 5.38, 300 K) vs PREM
(Dziewonski & Anderson 1981). Prints the density each gives at PREM's pressure and the gap to PREM."""
import math
A, B, R0T = 1.28e11, 1.05e11, 7800.0
V0, K0, KP = 22.428e-30, 163.4e9, 5.38
R0V = 2 * 55.845 * 1.66054e-27 / V0
def till(P): mu = (-A + math.sqrt(A * A + 4 * B * P)) / (2 * B); return R0T * (1 + mu)
def vinet_p(rho): x = (R0V / rho) ** (1 / 3); return 3 * K0 * (1 - x) / x ** 2 * math.exp(1.5 * (KP - 1) * (1 - x))
def vinet(P):
    lo, hi = R0V, 3 * R0V
    for _ in range(80):
        m = 0.5 * (lo + hi); lo, hi = (m, hi) if vinet_p(m) < P else (lo, m)
    return 0.5 * (lo + hi)
print(f"hcp Fe rho0 {R0V:.0f} kg/m3 (Tillotson rho0 {R0T:.0f})")
for name, P, rp in [("CMB, outer core top", 135.75e9, 9903.4), ("ICB, outer core base", 328.85e9, 12166.3),
                    ("ICB, inner core top", 328.85e9, 12763.6), ("centre", 363.85e9, 13088.5)]:
    t, v = till(P), vinet(P)
    print(f"{name:21s} P {P/1e9:6.1f} GPa  Tillotson {t:6.0f}  Vinet hcp-Fe {v:6.0f}  PREM {rp:6.0f}  "
          f"Tillotson +{(t-rp)/rp*100:4.1f}%  Vinet +{(v-rp)/rp*100:4.1f}%")
