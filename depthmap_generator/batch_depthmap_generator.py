"""
Stereogram Depth Map Batch Generator Pipeline
==============================================
Chains:
  1. Stereogram 3D Subject Prompt Synthesizer (Ollama, OpenRouter, or Procedural LLM Generator)
  2. Qwen-Image-2.1 Diffusion Model (produces 3D figure with isolated dark background)
  3. Depth Anything V2 (produces clean, relative metric grayscale depth map: 255 = near, 0 = far)
"""

import os
import sys
import time
import argparse
import random
from pathlib import Path
from typing import List, Dict, Optional

import torch
import numpy as np
from PIL import Image

# ==========================================
# 1. Stereogram Subject Prompt Generator
# ==========================================

SYSTEM_PROMPT = """You are an expert 3D sculptor and autostereogram depth map designer.
Your task is to write a single detailed prompt for an image generator (Qwen-Image-2.1) that will produce an exceptional 3D figure for an autostereogram depth map.

Rules for great stereogram depth figures:
1. Single isolated subject (e.g. dragon, roaring lion, skull, mechanical scorpion, praying mantis, gargoyle, anatomical heart, rearing unicorn, kinetic fractal geometry).
2. Volumetric forward depth: dramatic forward-protruding features (horns, claws, snout, outstretched arms) to create rich parallax depth planes.
3. Isolated on a solid pure black background with clean silhouette borders.
4. Studio rim lighting, matte clay/stone/ceramic/metal finish, octane render, 8k resolution, crisp details.
5. Output ONLY the raw prompt string, with no quotes, introductory remarks, or markdown.
"""

PROCEDURAL_TEMPLATES = [
    "A stunning 3D digital sculpture of {subject}, {pose}, with deep forward-protruding {features}, matte {material} finish, dramatic studio rim lighting, isolated on solid pure black background, octane render, volumetric stereogram depth, 8k resolution",
    "A majestic 3D {material} carving of {subject}, {pose}, layered volumetric depth with sharp {features}, studio spotlighting, clean silhouette on pure black background, photorealistic 3D relief, stereogram model",
    "A highly detailed mechanical cybernetic 3D sculpture of {subject}, {pose}, intricate exposed gears and protruding {features}, matte titanium and dark graphite, cinematic studio lighting, isolated on solid black background, volumetric 3D heightfield",
    "A mythical 3D embossed figure of {subject}, {pose}, dramatic perspective with near-plane {features} reaching toward the camera, matte white plaster finish, soft rim light, clean solid black background, 3D relief heightfield"
]

SUBJECTS = [
    "an ancient mythological dragon",
    "a roaring sabertooth tiger",
    "a coiled venomous king cobra with hood spread",
    "a magnificent rearing Pegasus with feathered wings",
    "an ornate gothic cathedral gargoyle with folded wings",
    "a biomechanical armored scarab beetle",
    "a deep-sea giant kraken with swirling tentacles",
    "a menacing cybernetic skull with exposed circuitry",
    "a crystalline geometric polyhedral fractal entity",
    "a predatory Tyrannosaurus Rex with wide open jaws",
    "an armored medieval knight in decorative gothic plate",
    "a mystical horned owl with spread wings on a pedestal",
    "a fantasy phoenix rising with forward-swept fiery wings",
    "an intricate baroque chess king with crowned filigree",
    "a prehistoric mammoth with giant curved ivory tusks"
]

POSES = [
    "perched menacingly on a rock with wings swept forward",
    "leaning forward in dynamic predatory stance",
    "rearing upwards with front limbs extended",
    "coiled in complex spiraling layers toward the camera",
    "facing three-quarter angle with dramatic perspective",
    "standing in proud heroic posture with layered depth planes"
]

FEATURES = [
    "snout, curved horns, and sharp front talons",
    "glowing eyes, pointed fangs, and layered muscle definition",
    "intricate scales, ribbed wings, and segmented plates",
    "overlapping feathers, talons, and expressive facial details",
    "sharp metallic ridges, piston hydraulics, and layered armor"
]

MATERIALS = [
    "matte gray clay",
    "chiseled white Carrara marble",
    "dark oxidized bronze",
    "matte ceramic porcelain",
    "fine-grain volcanic basalt stone",
    "matte carbon-fiber and brushed pewter"
]

def generate_prompt_procedural() -> str:
    """Generates an optimized prompt using curated 3D stereogram templates."""
    template = random.choice(PROCEDURAL_TEMPLATES)
    return template.format(
        subject=random.choice(SUBJECTS),
        pose=random.choice(POSES),
        features=random.choice(FEATURES),
        material=random.choice(MATERIALS)
    )

def query_ollama_prompt(model: str = "qwen2.5:7b", host: str = "http://127.0.0.1:11434") -> Optional[str]:
    """Queries local Ollama instance for a creative stereogram 3D figure prompt."""
    import urllib.request
    import json
    
    url = f"{host}/api/generate"
    payload = {
        "model": model,
        "prompt": "Create one unique image prompt for an impressive 3D figure that will produce a stunning autostereogram depth map.",
        "system": SYSTEM_PROMPT,
        "stream": False,
        "options": {
            "temperature": 0.85,
            "top_p": 0.9
        }
    }
    
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            prompt = data.get("response", "").strip()
            # Clean any leftover markdown or quotes
            prompt = prompt.replace('"', '').replace('**', '').replace('Prompt:', '').strip()
            if len(prompt) > 20:
                return prompt
    except Exception as e:
        print(f"  [Notice] Ollama query failed ({e}); falling back to procedural synthesizer.")
    return None

def get_stereogram_prompt(use_ollama: bool = True, ollama_model: str = "qwen2.5:7b") -> str:
    """Gets prompt from Ollama or falls back to procedural generator."""
    if use_ollama:
        prompt = query_ollama_prompt(model=ollama_model)
        if prompt:
            return prompt
    return generate_prompt_procedural()

# ==========================================
# 2. Main Generation Loop
# ==========================================

def run_batch_generation(
    num_images: int = 5,
    output_dir: str = "./outputs",
    aspect_ratio: str = "1:1",
    resolution_scale: float = 0.5,
    num_steps: int = 30,
    guidance_scale: float = 4.0,
    use_ollama: bool = True,
    ollama_model: str = "qwen2.5:7b",
    depth_model_id: str = "depth-anything/Depth-Anything-V2-Large-hf",
    device: str = "cuda"
):
    """
    Executes the end-to-end batch generation loop.
    """
    out_path = Path(output_dir)
    figures_dir = out_path / "3D_Figures"
    depthmaps_dir = out_path / "Stereogram_Depthmaps"
    figures_dir.mkdir(parents=True, exist_ok=True)
    depthmaps_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print("🚀 STEREOGRAM DEPTH MAP BATCH GENERATOR")
    print(f"  Total Images:    {num_images}")
    print(f"  Output Dir:      {out_path.resolve()}")
    print(f"  Device:          {device} ({torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'})")
    print("=" * 70)

    # 1. Load Qwen-Image-2.1 Pipeline
    from diffusers import QwenImage21Pipeline
    from transformers import pipeline as hf_pipeline

    print("\n📦 [1/2] Loading Qwen-Image-2.1 Pipeline...")
    qwen_pipe = QwenImage21Pipeline.from_pretrained(
        "Qwen/Qwen-Image-2.1",
        torch_dtype=torch.bfloat16
    )
    
    total_vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3) if torch.cuda.is_available() else 0
    if total_vram_gb > 50:
        qwen_pipe.to("cuda")
        print("  ✓ Qwen-Image-2.1 loaded directly into VRAM (High VRAM detected)")
    else:
        qwen_pipe.enable_model_cpu_offload()
        print("  ✓ Qwen-Image-2.1 loaded with CPU offloading (keeps peak VRAM < 18GB)")

    # 2. Load Depth Anything V2 Pipeline
    print("\n📦 [2/2] Loading Depth Anything V2 Pipeline...")
    depth_pipe = hf_pipeline(
        task="depth-estimation",
        model=depth_model_id,
        device=0 if device == "cuda" else -1,
        torch_dtype=torch.bfloat16 if device == "cuda" else torch.float32
    )
    print("  ✓ Depth Anything V2 loaded successfully")

    # Dimensions calculation (multiples of 32)
    aspect_map = {
        "1:1":  (2048, 2048),
        "4:3":  (2400, 1792),
        "16:9": (2752, 1536),
        "3:2":  (2528, 1696),
    }
    base_w, base_h = aspect_map.get(aspect_ratio, (2048, 2048))
    target_w = max(256, int(round((base_w * resolution_scale) / 32)) * 32)
    target_h = max(256, int(round((base_h * resolution_scale) / 32)) * 32)
    print(f"\nTarget Render Resolution: {target_w}x{target_h} (Scale: {resolution_scale}x)")

    negative_prompt = (
        "blurry, low quality, flat, noisy, cluttered background, multiple subjects, "
        "text, watermark, cropped, noisy texture in background"
    )

    # 3. Execution Loop
    for i in range(1, num_images + 1):
        print(f"\n[{i}/{num_images}] ----------------------------------------------------")
        
        # Step A: Generate Prompt
        prompt = get_stereogram_prompt(use_ollama=use_ollama, ollama_model=ollama_model)
        print(f"  📝 Prompt:\n     \"{prompt}\"")

        seed = random.randint(1, 2147483647)
        generator = torch.Generator(device="cuda" if device == "cuda" else "cpu").manual_seed(seed)

        # Step B: Generate 3D Figure
        print(f"  🎨 Generating 3D Figure with Qwen-Image-2.1 (Seed: {seed})...")
        t0 = time.time()
        result = qwen_pipe(
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=target_w,
            height=target_h,
            num_inference_steps=num_steps,
            true_cfg_scale=guidance_scale,
            generator=generator
        )
        rgb_image = result.images[0]
        render_time = time.time() - t0
        print(f"     ✓ Rendered in {render_time:.2f}s")

        fig_filename = f"figure_{i:03d}_seed{seed}.png"
        rgb_image.save(figures_dir / fig_filename)

        # Step C: Generate Depth Map with Depth Anything V2
        print("  📐 Estimating Volumetric Depth with Depth Anything V2...")
        t1 = time.time()
        depth_output = depth_pipe(rgb_image)
        depth_raw = depth_output["depth"]  # PIL Image in uint8 or float

        # Normalize to ensure optimal stereogram dynamic range
        depth_arr = np.array(depth_raw).astype(np.float32)
        d_min, d_max = depth_arr.min(), depth_arr.max()
        if d_max > d_min:
            depth_norm = ((depth_arr - d_min) / (d_max - d_min) * 255.0).astype(np.uint8)
        else:
            depth_norm = depth_arr.astype(np.uint8)

        depth_img = Image.fromarray(depth_norm, mode="L")
        depth_time = time.time() - t1
        print(f"     ✓ Depth estimated in {depth_time:.2f}s")

        depth_filename = f"depthmap_{i:03d}_seed{seed}.png"
        depth_img.save(depthmaps_dir / depth_filename)

        print(f"  💾 Saved paired assets:")
        print(f"     • 3D Figure:  {figures_dir / fig_filename}")
        print(f"     • Depth Map:  {depthmaps_dir / depth_filename}")

    print("\n" + "=" * 70)
    print(f"🎉 Batch generation finished! {num_images} stereogram depth maps created.")
    print(f"   Outputs ready in: {out_path.resolve()}")
    print("=" * 70)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Stereogram Depth Map Batch Generator")
    parser.add_argument("--count", type=int, default=5, help="Number of depthmaps to generate")
    parser.add_argument("--out", type=str, default="./outputs", help="Output directory")
    parser.add_argument("--scale", type=float, default=0.5, help="Resolution scale (0.5 = 1K, 1.0 = 2K)")
    parser.add_argument("--aspect", type=str, default="1:1", choices=["1:1", "4:3", "16:9", "3:2"], help="Aspect ratio")
    parser.add_argument("--steps", type=int, default=30, help="Inference steps")
    parser.add_argument("--ollama", action="store_true", help="Enable Ollama for dynamic prompts")
    parser.add_argument("--ollama-model", type=str, default="qwen2.5:7b", help="Ollama model name")
    
    args = parser.parse_args()
    run_batch_generation(
        num_images=args.count,
        output_dir=args.out,
        aspect_ratio=args.aspect,
        resolution_scale=args.scale,
        num_steps=args.steps,
        use_ollama=args.ollama,
        ollama_model=args.ollama_model
    )
