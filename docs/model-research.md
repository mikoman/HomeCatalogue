# Local vision models for Home Catalogue

Research date: **11 September 2026**. Sources are maintainer documentation, model cards, model files, and research papers.

These recommendations target household photos, small labels, repeated objects, open containers, and editable bounding boxes. They do not establish a universal benchmark winner. No model inference or memory benchmark ran during this research.

## Recommended choices

Use **Qwen3.5 9B with YOLOE-26s** as the practical starting point. This combination leaves memory for the application and other desktop software. Use **Qwen3.8 27B Q4_K_M** when identification quality matters more than response time. Test **YOLOE-26m or YOLOE-26l** when the small detector misses objects.

This selection follows the published capabilities and runtime support below. It remains a project recommendation, pending tests with representative household photos.

| Role | Exact Ollama tag | Published download | Selection reason |
|---|---|---:|---|
| Practical default | `qwen3.5:9b` | 6.6 GB, Q4_K_M | Modern visual recognition, OCR, counting, and grounding with substantial memory headroom. [Ollama](https://ollama.com/library/qwen3.5:9b) |
| Quality candidate for 32 GB unified memory | `qwen3.8:27b` | 18 GB, Q4_K_M and BF16 projector | Current Qwen dense vision model. Start with one request and a limited context. [Ollama](https://ollama.com/library/qwen3.8:27b) |
| Lower memory and CPU alternative | `qwen3.5:4b` | 3.4 GB, Q4_K_M | Useful when 9B responses take too long. Check small objects and label accuracy. [Ollama](https://ollama.com/library/qwen3.5:4b) |
| Alternative model family | `gemma4:12b` | 7.6 GB, Q4_K_M | A compact comparison model with image support. [Ollama](https://ollama.com/library/gemma4:12b) |
| Mixture-of-experts alternative | `gemma4:26b` | 19 GB, Q4_K_M and BF16 projector | About 4B active parameters reduce computation. All expert weights still consume memory. [Ollama](https://ollama.com/library/gemma4:26b) |
| Compatibility baseline | `qwen3-vl:8b` | 6.1 GB, Q4_K_M | Retain for comparison or runtime compatibility. It supports vision and spatial grounding. [Ollama](https://ollama.com/library/qwen3-vl:8b) |

These are download sizes, not peak RAM requirements. The listed Qwen and Gemma tags use Apache 2.0 licenses. Ollama tags can change, so record the downloaded digest for repeatable comparisons.

### Why these models

Qwen released the small Qwen3.5 models on 2 March 2026 and Qwen3.8-27B on 14 August 2026. Thus, Qwen3-VL is a useful baseline, but it is no longer the latest Qwen vision generation. [Qwen release history](https://github.com/QwenLM/Qwen3.8#news)

Qwen reports these Qwen3.5-9B results: RealWorldQA 80.3, OCRBench 89.2, CountBench 97.2, and RefCOCO average 89.7. These tasks make the model relevant to object naming, labels, counts, and grounding. They do not measure Home Catalogue accuracy. The model card also shows that 4B remains competitive, with lower scores on these four tasks. [Qwen3.5-9B model card](https://huggingface.co/Qwen/Qwen3.5-9B)

Qwen3.8-27B reports RealWorldQA 85.9 and OmniDocBench 1.5 at 91.1. Qwen3.6-27B scores 84.1 and 89.4 in the same table. This evidence supports testing Qwen3.8 as the quality option. The published scores do not establish the accuracy of its Q4 quantization or this application's prompts. [Qwen3.8-27B model card](https://huggingface.co/Qwen/Qwen3.8-27B)

Gemma 4 supports images across its size range. Its 12B model uses a unified architecture, while 26B A4B uses a mixture of experts. Google reports different OmniDocBench metrics from some other model cards. Do not rank those raw values as if they share one evaluation procedure. [Google model card](https://ai.google.dev/gemma/docs/core/model_card_4)

## Deployment on 32 GB machines

**32 GB of system RAM does not mean 32 GB of GPU VRAM.** A discrete GPU has a separate memory budget. A 32 GB Apple Silicon machine shares memory across the CPU, GPU, operating system, and applications.

Ollama can place a model wholly on the GPU, wholly on the CPU, or across both. Larger context windows and concurrent requests increase memory use. Check `ollama ps` for the actual placement and loaded size. [Ollama memory and concurrency guidance](https://docs.ollama.com/faq)

Use these starting settings for inventory scans. These are conservative project settings, not measured limits:

1. Set the context to 8,192 tokens.
2. Process one vision request at a time.
3. Keep only one large language model loaded.
4. Test one photograph before a batch.
5. Increase context only when the image and JSON response require it.
6. Reduce context or model size if memory pressure or CPU transfer causes delays.

For Ollama, the relevant controls are `options.num_ctx`, `OLLAMA_NUM_PARALLEL=1`, and `OLLAMA_MAX_LOADED_MODELS=1`. Set these server variables before starting Ollama. [Ollama FAQ](https://docs.ollama.com/faq)

Use Qwen3.5 4B or 9B first on a machine with limited GPU memory. A 27B model may fit in system RAM but respond slowly through CPU inference. On 32 GB unified memory, try Qwen3.8 27B Q4 before larger quantizations. Do not load it alongside another large VLM, SAM 3, and an embedding model without measuring the combined allocation.

### LM Studio and Apple Silicon

LM Studio lists `qwen/qwen3.8-27b` with both GGUF and MLX variants. Its catalog supports vision input and exposes thinking controls. Select a vision-capable package, then use the actual identifier returned by the local server's model list. A catalog name is not necessarily the server's loaded model identifier. [LM Studio catalog](https://lmstudio.ai/models/qwen/qwen3.8-27b)

| Package | Q4 language file | Required vision projector |
|---|---:|---:|
| `lmstudio-community/Qwen3.8-27B-GGUF` | `Qwen3.8-27B-Q4_K_M.gguf`, 16.8 GB | `mmproj-Qwen3.8-27B-BF16.gguf`, 931 MB. [Files](https://huggingface.co/lmstudio-community/Qwen3.8-27B-GGUF/tree/main) |
| `lmstudio-community/Qwen3.5-9B-GGUF` | `Qwen3.5-9B-Q4_K_M.gguf`, 5.63 GB | `mmproj-Qwen3.5-9B-BF16.gguf`, 922 MB. [Files](https://huggingface.co/lmstudio-community/Qwen3.5-9B-GGUF/tree/main) |

Qwen3.8 Q6_K alone is 22.4 GB. Q8_0 alone is 29 GB. Neither figure includes its projector, runtime buffers, context, or the operating system. This makes Q4_K_M the sensible initial 32 GB choice. [Quantized files](https://huggingface.co/lmstudio-community/Qwen3.8-27B-GGUF/tree/main)

For Apple Silicon, LM Studio also lists `lmstudio-community/Qwen3.8-27B-MLX-4bit`. Use a vision runtime. Qwen distinguishes `mlx-vlm`, which supports images, from the text-only `mlx-lm` path. [LM Studio variants](https://lmstudio.ai/models/qwen/qwen3.8-27b), [Qwen runtime guidance](https://github.com/QwenLM/Qwen3.8#local-use)

## Bounding boxes and segmentation

Use the VLM to propose names and attributes. Use a detector to locate objects. A plausible description does not establish accurate box coordinates.

**YOLOE-26 replaces YOLO-World as the preferred detector family to test.** It adds text prompting, visual examples, and segmentation masks. The text-prompt checkpoints preserve the existing `set_classes()` workflow. The small model is the starting choice for unknown hardware. Medium and large models trade more computation for stronger published detection results. [Ultralytics YOLOE documentation](https://docs.ultralytics.com/models/yoloe)

| Detector | Exact checkpoint | Purpose |
|---|---|---|
| Default candidate | `yoloe-26s-seg.pt` | Text prompts with boxes and optional masks. |
| Quality alternatives | `yoloe-26m-seg.pt`, `yoloe-26l-seg.pt` | Test on crowded shelves and less common objects. |
| Discovery experiment | `yoloe-26s-seg-pf.pt` | Uses a built-in vocabulary. It rejects `set_classes()`. |
| Existing baseline | `yolov8x-worldv2.pt` | Retain for regression comparisons. |

The YOLO26 paper reports LVIS text-prompt AP of 30.8, 35.4, and 37.8 for YOLOE-26s, m, and l. These use its Non-E2E evaluation procedure. Released segmentation checkpoints differ from the paper's detection configuration. These results do not establish a comparison against this project's existing YOLO-World x checkpoint. [YOLO26 paper](https://arxiv.org/abs/2606.03748), [Ultralytics checkpoint details](https://docs.ultralytics.com/models/yoloe#yoloe-performance-on-lvis)

YOLOE-26 requires `ultralytics>=8.4.0`. The first `set_classes()` call installs the CLIP tokenizer dependency and downloads `mobileclip2_b.ts`, approximately 254 MB. Complete one prompted prediction before offline use. Exported models contain fixed classes, so dynamic prompts require the original PyTorch checkpoint. [Installation and export details](https://docs.ultralytics.com/models/yoloe)

```python
from ultralytics import YOLOE

model = YOLOE("yoloe-26s-seg.pt")
model.set_classes(["storage box", "bottle", "book", "mug"])
results = model.predict("shelf.jpg", imgsz=960, conf=0.2, verbose=False)
boxes = results[0].boxes
masks = results[0].masks
```

The image size and confidence above are starting values for evaluation. They are not calibrated thresholds. Larger images can help small objects but consume more computation. [Ultralytics prediction settings](https://docs.ultralytics.com/usage/cfg/)

### Alternatives and their limits

- **Grounding DINO:** `IDEA-Research/grounding-dino-base` provides open-vocabulary boxes through Transformers. It uses Apache 2.0 and offers a useful independent comparison. The maintainer example supports CPU and CUDA. Test phrase grounding and crowded scenes before selecting it over YOLOE. [Model card](https://huggingface.co/IDEA-Research/grounding-dino-base)
- **Grounding DINO 1.5:** the reviewed official project distributes an API workflow. Do not label its hosted service as a downloadable local replacement. [Official repository](https://github.com/IDEA-Research/Grounding-DINO-1.5-API)
- **SAM 3:** `facebook/sam3` is a candidate for text-guided masks and difficult boundaries. Its reference installation requires Python 3.12+, PyTorch 2.7+, and CUDA 12.6+. It needs a separate integration and memory test. [Meta repository](https://github.com/facebookresearch/sam3)
- **SAM 3.1:** Meta released improved checkpoints on 27 March 2026. The update focuses on efficient multi-object video tracking, which does not establish better household still-image classification. [Meta release notes](https://github.com/facebookresearch/sam3/blob/main/RELEASE_SAM3p1.md)
- **SAM 2.1 small:** `facebook/sam2.1-hiera-small` offers an Apache 2.0 option for mask refinement from points or boxes. It needs another source of category labels. [Model card](https://huggingface.co/facebook/sam2.1-hiera-small)

YOLOE already provides masks. Add a separate SAM stage only if improved boundaries justify its latency and maintenance cost. Open-vocabulary segmentation does not identify exact product variants or establish physical containment.

## OCR and image search extensions

These components require additional application integration. They are not replacements for the current vision-provider setting.

**Dedicated OCR:** test `PP-OCRv6_small_det` with `PP-OCRv6_small_rec` for labels, brands, and model numbers. Use the corresponding `medium` pair when accuracy matters more than latency. The model cards list these names and Apache 2.0 licenses. [Small detector](https://huggingface.co/PaddlePaddle/PP-OCRv6_small_det), [Small recognizer](https://huggingface.co/PaddlePaddle/PP-OCRv6_small_rec), [Medium recognizer and pipeline](https://huggingface.co/PaddlePaddle/PP-OCRv6_medium_rec)

PaddleOCR documents Windows, Linux, Mac, and ONNX Runtime paths. Its PP-OCRv6 evaluation reports different speed and accuracy trade-offs across small, tiny, and medium variants. Those tests use specific hardware and datasets. Preserve original text instead of asking a VLM to rewrite uncertain serial numbers. [PP-OCRv6 documentation](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/algorithm/PP-OCRv6/PP-OCRv6.en.md)

**Lightweight visual search:** start with `google/siglip2-base-patch16-384`. Its published weights occupy 1.5 GB. It supports candidate-label classification and image/text similarity. Use it for similar-item search or category checks on crops, not box generation. [Google model and files](https://huggingface.co/google/siglip2-base-patch16-384/tree/main)

**Richer multimodal retrieval:** test `Qwen/Qwen3-VL-Embedding-2B`. It supports image and text retrieval, with 4.26 GB of published weights and Sentence Transformers integration. It consumes more memory than SigLIP2 base. Neither model makes a similarity score proof that two photographs show the same physical item. [Qwen model card](https://huggingface.co/Qwen/Qwen3-VL-Embedding-2B), [Model files](https://huggingface.co/Qwen/Qwen3-VL-Embedding-2B/tree/main)

## Other models considered

| Candidate | Assessment for this project |
|---|---|
| `meta-models/Muse-Glimmer-30B` | Current Apache 2.0 vision model with official quantizations for 24/32 GB VRAM. Its main evaluations target agent tasks. This does not prove stronger inventory extraction or a 32 GB system-RAM fit. [Meta model card](https://huggingface.co/meta-models/Muse-Glimmer-30B) |
| `moondream/moondream3-preview` | Provides native `detect()` and `point()` methods with normalized coordinates. Its reference code uses CUDA, custom model code, and compilation. Its Business Source License differs from Apache 2.0. Keep it as a specialist experiment. [Maintainer model card](https://huggingface.co/moondream/moondream3-preview) |
| `OpenGVLab/InternVL3_5-8B` | Apache 2.0 visual model with Transformers examples. The reviewed card requires custom model code. It needs a separately verified serving path for this application. [Model card](https://huggingface.co/OpenGVLab/InternVL3_5-8B) |
| `ministral-3:14b` | An available Ollama vision alternative with a 9.1 GB download. It is a reasonable comparison model, but the reviewed evidence does not establish an inventory advantage. [Official tags](https://ollama.com/library/ministral-3/tags) |
| `mistralai/Mistral-Small-3.2-24B-Instruct-2506` | Apache 2.0 visual model. Its update concentrates on instruction following and repetition. Retain as a compatibility candidate rather than the latest default. [Mistral model card](https://huggingface.co/mistralai/Mistral-Small-3.2-24B-Instruct-2506) |

## Recommended method

The following steps describe the proposed processing method. The [README](../README.md) identifies which options the application currently implements.

1. Normalize image orientation before any model sees the photograph.
2. Use a whole-image VLM pass to propose visible items and containers.
3. Build concise detector prompts from visible object classes.
4. Keep product names separate from detector class names.
5. Ask the detector to locate the proposed classes.
6. Reject invalid coordinates before matching boxes to items.
7. Match repeated items to distinct detections.
8. Reinspect uncertain crops for names, attributes, and small text.
9. Preserve original-image coordinates when processing crops or tiles.
10. Request review for uncertain identity, counts, or containment.

Use crops or overlapping tiles when one reduced image hides small objects. Merge duplicates only after mapping every result to original-image coordinates. Evaluate overlap thresholds on repeated objects, since excessive suppression can remove adjacent bottles or books.

Preserve detector confidence separately from the VLM's self-reported confidence. Neither is a calibrated probability without evaluation. A shelf around an object in two dimensions does not prove that the object belongs to that container. Do not invent objects inside closed or opaque containers.

For structured output, pass the JSON Schema through Ollama's `format` field. Check the result with Pydantic. Vision models support the same schema mechanism. Reject truncated, empty, and schema-invalid answers. A schema constrains structure, but it does not establish accurate names or geometry. [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs)

For simple extraction, test `think: false` on supported Qwen models. Reasoning can consume the output budget before the final JSON appears. Parse the final `message.content`, not `message.thinking`. LM Studio provides equivalent model controls through its interface. [Ollama thinking](https://docs.ollama.com/capabilities/thinking), [LM Studio controls](https://lmstudio.ai/models/qwen/qwen3.8-27b)

## Validation and evidence limits

Compare candidates on the same saved photographs and reviewed labels. Include crowded shelves, clear containers, dark drawers, repeated items, small text, and empty scenes.

Record these measures:

- Item precision and recall, including hallucinated items.
- Name and category accuracy.
- Count errors for repeated objects.
- Box overlap with reviewed boxes and missed-box rate.
- Exact OCR accuracy for visible labels and identifiers.
- Incorrect container assignments.
- Valid JSON rate, retry rate, total latency, and peak memory.
- Runtime version, model digest, quantization, context, and image resolution.

A benchmark score from another dataset does not replace these checks. H200, B200, and RTX measurements do not establish Apple Silicon or CPU throughput. Download size does not establish runtime memory. Model availability does not establish that an installed runtime supports its image path.

Search metadata can disagree with release dates. This note uses maintainer release history for Qwen dates. The Qwen embedding paper also contains a ranking date of January 2025 despite its January 2026 submission. This note does not use that dated ranking claim. [Qwen release history](https://github.com/QwenLM/Qwen3.8#news), [Embedding paper](https://arxiv.org/abs/2601.04720)

The application's MIT license does not replace model or dependency licenses. Ultralytics distributes its software and models under AGPL-3.0 or an Enterprise license. SAM 3 uses Meta's separate SAM License. Check the applicable terms before distributing an integrated product. [Ultralytics terms](https://www.ultralytics.com/license), [SAM License](https://github.com/facebookresearch/sam3/blob/main/LICENSE)
