# 🐲 Stereogram 3D Depth Map Generator (ComfyUI & Colab)

An automated AI pipeline to generate high-quality volumetric grayscale depth maps for **StereoCraft** autostereograms.

---

## 🏗️ Architecture & Dataflow

```
┌─────────────────────────────────┐
│       1. Text LLM               │
│   (Ollama qwen2.5 / OpenRouter) │ ──► Crafts 3D Stereogram Figure Prompts
└────────────────┬────────────────┘     (Volumetric relief, rim lighting, black background)
                 ▼
┌─────────────────────────────────┐
│     2. Qwen-Image-2.1           │
│   (Diffusion Transformer)       │ ──► Renders High-Fidelity 3D Model Image
└────────────────┬────────────────┘     (1024x1024 / 2048x2048 octane render)
                 ▼
┌─────────────────────────────────┐
│     3. Depth Anything V2        │
│   (Metric Depth Estimator)      │ ──► Extracts Continuous Grayscale Depth Map
└────────────────┬────────────────┘     (255 = near / protruding, 0 = far / black)
                 ▼
┌─────────────────────────────────┐
│     4. Google Drive Output      │
│   (My Drive/Stereogram_Depthmaps)│ ──► Paired 3D Figure + Stereogram Depth Map PNGs
└─────────────────────────────────┘
```

---

## 📁 Files Included

| File | Purpose |
| :--- | :--- |
| **[`stereogram_depthmap_generator_colab.ipynb`](./stereogram_depthmap_generator_colab.ipynb)** | Complete Google Colab notebook configured for NVIDIA A100 GPU with ComfyUI, aria2c model downloads, Ngrok tunnel, and Google Drive auto-save. |
| **[`workflow_stereogram_depthmap_generator.json`](./workflow_stereogram_depthmap_generator.json)** | Visual ComfyUI workflow connecting Qwen-Image-2.1 with Depth Anything V2. |
| **[`batch_depthmap_generator.py`](./batch_depthmap_generator.py)** | Standalone Python batch generator script for automated loop execution without needing a web UI. |

---

## 🚀 How to Run in Google Colab

1. **Upload Notebook**:
   - Open [Google Colab](https://colab.research.google.com/).
   - Upload [`stereogram_depthmap_generator_colab.ipynb`](./stereogram_depthmap_generator_colab.ipynb).
2. **Select A100 GPU**:
   - Go to `Runtime` $\rightarrow$ `Change runtime type` $\rightarrow$ select **A100 GPU**.
3. **Execute Setup Cells**:
   - Run cells 1 through 5 to mount your Google Drive and download model weights (~24 GB total via 16-thread `aria2c` in ~3–5 minutes).
4. **Choose Execution Mode**:
   - **Mode A: ComfyUI Web Interface**:
     - Run Cell 7 to start ComfyUI and get a public URL (via Ngrok or `localhost.run`).
     - Load `workflow_stereogram_depthmap_generator.json`.
     - In the Queue options on the right, set **Batch count** to `5`, `10`, or `50` to automatically loop and generate!
   - **Mode B: Automated Python Batch Loop**:
     - Run Cell 8 directly in Colab.
     - Specify `NUM_IMAGES = 10` and run. It will loop, generate prompts, render 3D figures, estimate depth maps, display inline previews, and save them straight to Google Drive.

---

## 🎨 Using Generated Depth Maps in StereoCraft

1. Download the generated `.png` depth maps from your Google Drive folder: `MyDrive/Stereogram_Depthmaps/Stereogram_Depthmaps/`.
2. Move them to your local project folder: [`depthmaps/`](../depthmaps/).
3. Open **StereoCraft**:
   - Click **"Upload Image Depthmap"** in the shape palette.
   - Adjust the **Depth** slider, scale, and position.
   - Switch between **Wall-Eyed (Parallel)** and **Cross-Eyed** viewing modes or inspect in **3D Relief Mesh**!
