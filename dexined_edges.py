import os
import sys

import cv2
import numpy as np
import torch


def imread_unicode(path):
    data = np.fromfile(path, dtype=np.uint8)
    image = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError(f"Could not load image: {path}")
    return image


def imwrite_unicode(path, image):
    ok, buffer = cv2.imencode(".png", image)
    if not ok:
        raise RuntimeError(f"Could not write image: {path}")
    buffer.tofile(path)


def find_checkpoint(dexined_dir):
    candidates = [
        os.path.join(dexined_dir, "checkpoints", "BIPED", "10", "10_model.pth"),
        os.path.join(dexined_dir, "checkpoints", "BIPED", "10_model.pth"),
    ]
    for root, _, files in os.walk(os.path.join(dexined_dir, "checkpoints")) if os.path.isdir(os.path.join(dexined_dir, "checkpoints")) else []:
        for file_name in files:
            if file_name.lower().endswith((".pth", ".pt")):
                candidates.append(os.path.join(root, file_name))
    for candidate in candidates:
        if os.path.isfile(candidate):
            return candidate
    return None


def pad_to_multiple(image, multiple=16):
    height, width = image.shape[:2]
    padded_h = int(np.ceil(height / multiple) * multiple)
    padded_w = int(np.ceil(width / multiple) * multiple)
    if padded_h == height and padded_w == width:
        return image, height, width
    padded = cv2.copyMakeBorder(image, 0, padded_h - height, 0, padded_w - width, cv2.BORDER_REFLECT_101)
    return padded, height, width


def run_model(input_paths, output_paths, dexined_dir, checkpoint):
    sys.path.insert(0, dexined_dir)
    from model import DexiNed

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model = DexiNed().to(device)
    state = torch.load(checkpoint, map_location=device)
    if isinstance(state, dict) and "state_dict" in state:
        state = state["state_dict"]
    state = {key.replace("module.", ""): value for key, value in state.items()}
    model.load_state_dict(state, strict=False)
    model.eval()

    for input_path, output_path in zip(input_paths, output_paths):
        image = imread_unicode(input_path)
        padded, original_h, original_w = pad_to_multiple(image)
        rgb = cv2.cvtColor(padded, cv2.COLOR_BGR2RGB).astype(np.float32)
        tensor = torch.from_numpy(rgb.transpose(2, 0, 1)).unsqueeze(0).to(device)

        with torch.no_grad():
            pred = model(tensor)[-1]
            pred = torch.sigmoid(pred)[0, 0].detach().cpu().numpy()

        pred = pred[:original_h, :original_w]
        pred = (pred - pred.min()) / max(1e-6, pred.max() - pred.min())
        edge = (pred * 255).astype(np.uint8)
        imwrite_unicode(output_path, edge)


def main():
    if len(sys.argv) < 3:
        raise SystemExit("Usage: dexined_edges.py <input1> <output1> [<input2> <output2> ...]")

    pairs = sys.argv[1:]
    if len(pairs) % 2 != 0:
        raise SystemExit("Arguments must be pairs of <input> <output>")

    input_paths = [os.path.abspath(pairs[i]) for i in range(0, len(pairs), 2)]
    output_paths = [os.path.abspath(pairs[i + 1]) for i in range(0, len(pairs), 2)]

    root_dir = os.path.dirname(os.path.abspath(__file__))
    dexined_dir = os.environ.get("DEXINED_DIR") or os.path.join(root_dir, "third_party", "DexiNed")

    if not os.path.isdir(dexined_dir):
        raise SystemExit("DexiNed is not configured. Run setup-dexined.bat first.")

    checkpoint = os.environ.get("DEXINED_CHECKPOINT") or find_checkpoint(dexined_dir)
    if not checkpoint:
        raise SystemExit(
            f"DexiNed checkpoint not found. Put 10_model.pth under "
            f"{os.path.join(dexined_dir, 'checkpoints', 'BIPED', '10')}"
        )

    run_model(input_paths, output_paths, dexined_dir, checkpoint)


if __name__ == "__main__":
    main()
