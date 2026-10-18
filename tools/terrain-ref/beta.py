# Spectral slope of a DEM in bands (90-3000 m, 300-3000 m, 90-300 m).
import numpy as np, sys
from scipy import ndimage as ndi
def spec(z,cell=30):
    zz=z-ndi.gaussian_filter(z,2000/cell); F=np.abs(np.fft.fftshift(np.fft.fft2(zz*np.outer(np.hanning(z.shape[0]),np.hanning(z.shape[1])))))**2
    ky,kx=np.meshgrid(np.fft.fftshift(np.fft.fftfreq(z.shape[0],cell)),np.fft.fftshift(np.fft.fftfreq(z.shape[1],cell)),indexing='ij'); kr=np.hypot(kx,ky)
    bins=np.logspace(np.log10(1/8000),np.log10(1/60),30); idx=np.digitize(kr,bins); P=np.array([F[idx==i].mean() if (idx==i).any() else 0 for i in range(1,len(bins))]); kc=np.sqrt(bins[1:]*bins[:-1]); return kc,P
def beta(kc,P,lo,hi): m=(kc>1/hi)&(kc<1/lo); return round(float(np.polyfit(np.log(kc[m]),np.log(P[m]),1)[0]),2)
def bands(a): kc,P=spec(a); return [beta(kc,P,lo,hi) for lo,hi in ((90,3000),(300,3000),(90,300))]
