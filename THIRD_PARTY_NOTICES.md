# Third-Party Notices

DiffEye itself is licensed under the MIT License.
This file lists third-party software used by DiffEye and their respective
licenses.

DiffEye depends on third-party open-source software installed through npm and
pip. These packages are not copied into this repository; users install them
locally with `install.bat`, `npm install`, and `pip install`.

When redistributing DiffEye together with bundled dependencies, include the
license files and notices for those bundled dependencies.

## Direct npm dependencies

- `odiff-bin`  
  License: MIT  
  Repository: https://github.com/dmtrKovalenko/odiff  
  Used for strict pixel comparison mode.

- `express`  
  License: MIT  
  Repository: https://github.com/expressjs/express  
  Used for the local web server.

- `multer`  
  License: MIT  
  Repository: https://github.com/expressjs/multer  
  Used for local image upload handling.

The npm transitive dependency tree is recorded in `package-lock.json` and is
installed into `node_modules/` by npm. `node_modules/` is intentionally not
committed to this repository.

## Direct pip dependencies

- `opencv-python`  
  License: Apache-2.0  
  Repository: https://github.com/opencv/opencv-python  
  Used for image alignment, edge extraction, and structure comparison.

- `Pillow`  
  License: HPND  
  Project: https://python-pillow.org  
  Used as an image-processing dependency.

- `numpy`  
  License: BSD-3-Clause  
  Project: https://numpy.org  
  Used for image array processing.

Python packages are installed by pip into the user's Python environment and are
not committed to this repository.

## Optional DexiNed fine line mode

- `DexiNed`  
  License: MIT  
  Repository: https://github.com/xavysp/DexiNed  
  Used optionally for AI-assisted edge detection in fine line mode.

- `torch`  
  License: BSD-3-Clause  
  Project: https://pytorch.org  
  Required **only** when the optional DexiNed fine line mode is used. It is not
  needed for the default fast Canny edge mode and is not listed in
  `requirements.txt`.

DexiNed source code and checkpoint files are not committed to this repository.
When the user runs `setup-dexined.bat`, the official repository is cloned into
`third_party/DexiNed/`, which is ignored by git. Users must download the
official checkpoint separately from the DexiNed README and place it at:

```text
third_party\DexiNed\checkpoints\BIPED\10\10_model.pth
```

The bundled Python runtime at `runtime/` and the Node runtime shipped with the
portable package are third-party redistributables as well; they are excluded
from git by `.gitignore` and keep their own upstream licenses.
