# Home Catalogue

Home Catalogue is a self-hosted application for household inventory. It uses a vision model to identify objects in photographs.
You review the suggestions before the application saves items and containers.

**First installation?** Follow the [Docker quick start](#quick-start).

Use Ollama, LM Studio, or oMLX for local inference. Local servers can use an optional API key.
DeepSeek, OpenRouter, OpenAI, and Anthropic provide cloud inference. Cloud scans send photographs outside your machine and can incur charges.

The catalogue uses this structure:

```text
House → Room → Container → Item
```

Containers can contain other containers. You can search the catalogue by name, category, or tag.
You can also add items manually.

The September 2026 update adds OpenRouter, YOLOE-26 support, model recommendations for 32 GB machines, and capture and review improvements.
See the [application review](docs/app-review.md) for changes and validation limits.
See the [model research](docs/model-research.md) for model comparisons and sources.

## Contents

- [Features](#features)
- [Interface](#interface)
- [Technology](#technology)
- [Quick start](#quick-start)
- [Docker commands](#docker-commands)
- [Docker troubleshooting](#docker-troubleshooting)
- [Provider settings](#provider-settings)
- [AI providers](#ai-providers)
- [Models for 32 GB RAM](#models-for-32-gb-ram)
- [Bounding boxes](#bounding-boxes)
- [Processing methods](#processing-methods)
- [Use the catalogue](#use-the-catalogue)
- [Install as an app](#install-as-an-app)
- [Architecture](#architecture)
- [API reference](#api-reference)
- [Storage and backup](#storage-and-backup)
- [Development](#development)
- [Environment variables](#environment-variables)
- [License](#license)

## Features

| Feature | Description |
|---|---|
| Photo scans | A vision model identifies visible items and proposes containers. |
| Local and cloud inference | Select Ollama, LM Studio, oMLX, OpenRouter, DeepSeek, OpenAI, or Anthropic in Settings. |
| Provider settings | Configure providers, API keys, local server URLs, and models. Test connections and search model lists. |
| Background analysis | Upload multiple photographs. The server retains scan progress after a page refresh. |
| Container scans | Catalogue the visible contents of a drawer, bin, suitcase, or other container. |
| Nested containers | Organize items within containers and nested containers. |
| Item conversion | Convert an item into a container during review or from an existing item card. |
| Search | Search names, categories, and tags. Results include each item's location. |
| Item movement | Move items or complete container branches between rooms. |
| Scan review | Correct names and destinations. Exclude false detections before saving. |
| Mobile access | Use a responsive interface, camera capture, and an installable progressive web app (PWA). |
| Structured responses | Requests include a JSON Schema. The backend checks inventory fields. Ollama, OpenRouter, and DeepSeek also reject truncated completions. |
| Docker support | Use Docker Compose, builds with multiple stages, and automatic development reloads. |

## Interface

The Folio interface uses large item photos, serif headings, and visible storage locations.
The header switch selects light or dark mode and remembers the choice in this browser.
The first visit follows the system theme. Both themes include visible keyboard focus indicators.

| Element | Value |
|---|---|
| Light background | Ivory `#F5F2EB` |
| Dark background | Deep green `#131E19` |
| Light / dark action colour | Forest `#274B3E` / sage `#B8D3AF` |
| Heading typeface | Lora |
| Control and body typeface | Source Sans 3 |

Both typefaces load from local files. Their licences are in `frontend/public/fonts`.

The style configuration is in [tailwind.config.js](frontend/tailwind.config.js) and [index.css](frontend/src/index.css).

## Technology

| Component | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React Router |
| Backend | Python, FastAPI, SQLAlchemy, Pydantic v2 |
| Database | SQLite |
| Local AI | Ollama, LM Studio with an OpenAI-compatible API |
| Cloud AI | OpenRouter, or direct DeepSeek, OpenAI, and Anthropic connections |
| Deployment | Docker, Docker Compose, Nginx |

## Quick start

Follow these steps for a first installation with Docker.
Run commands in Terminal on macOS or Linux, or PowerShell on Windows.

Docker builds and runs the web app and backend. The backend creates the SQLite database automatically.
You do not need Python, Node.js, or a separate database installation for this setup.
AI model servers and the optional object detector run separately from these Docker containers.

### 1. Install the prerequisites

1. Install [Docker Desktop](https://docs.docker.com/compose/install/) on macOS or Windows.
2. Start Docker Desktop. Wait until its engine is running.
3. Install [Git](https://git-scm.com/downloads) if you will use the clone command below.

On Linux, use Docker Desktop or [Docker Engine with the Compose plugin](https://docs.docker.com/compose/install/linux/).
Start the Docker service before continuing.
On Windows, use Linux containers in Docker Desktop.

Check the installation:

```sh
docker --version
docker compose version
docker info
```

The first two commands must show version numbers. `docker info` must show server information without a connection or permission error.
Resolve Docker errors before continuing.

You also need internet access for the initial image builds and any model downloads.
Choose how you want to use the app:

| Use | What you need before your first scan |
|---|---|
| Cloud scans | An account and API key for DeepSeek, OpenRouter, OpenAI, or Anthropic. The account needs access to a vision model. Charges can apply. |
| Local scans | Ollama, LM Studio, or oMLX running on your computer, with an image-capable model installed. |
| Manual catalogue | No AI service or API key. You can add items manually. |

You can start the app before configuring AI. The cloud path does not require a local model server or GPU.

### 2. Download the project

Run:

```sh
git clone https://github.com/mikoman/HomeCatalogue.git homeCatalogue
cd homeCatalogue
```

If you already downloaded the project, open a terminal in its folder instead.
You can also use **Code → Download ZIP** on GitHub. Extract the ZIP before opening a terminal in the extracted folder.

This folder must contain `docker-compose.yml`, `.env.example`, `backend/`, and `frontend/`.
Run all Docker commands below from this folder, called the **repository root**.

### 3. Create the configuration and storage folders

For a new installation, copy the example configuration.
Do not repeat the copy over an existing `.env` file.

On macOS or Linux:

```sh
cp .env.example .env
mkdir -p storage/uploads
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
New-Item -ItemType Directory -Force storage/uploads
```

Keep the filename exactly `.env`, including the leading dot. Do not save it as `.env.txt`.

Open `.env` in a text editor. Clear the example OpenAI and Anthropic keys so those lines read:

```dotenv
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

You can leave the other copied values unchanged for the first Docker startup.
Enter real provider keys through the app in step 5.
The initial `AI_PROVIDER=ollama` does not prevent startup when Ollama is absent.

Keep these Docker storage values:

```dotenv
DATABASE_URL=sqlite:////app/storage/home_catalogue.db
UPLOAD_DIR=/app/storage/uploads
AI_SETTINGS_FILE=/app/storage/ai_settings.json
```

The four slashes in the SQLite URL are intentional.
Docker maps the repository's `storage/` folder to `/app/storage` inside the backend container.
This folder retains your database, uploaded photos, and saved provider settings when containers restart or are replaced.

### 4. Build and start Docker

Check the configuration first. This command produces no output when the configuration is valid:

```sh
docker compose config --quiet
```

Build and start both services:

```sh
docker compose up --build -d --wait
```

The first build downloads dependencies and can take several minutes.
`--build` builds the images. `-d` runs the containers in the background. `--wait` waits for running services and configured health checks.
See Docker's [startup command reference](https://docs.docker.com/reference/cli/docker/compose/up/) for these options.

Check the result:

```sh
docker compose ps
```

Expect `backend` to show **Up** and **healthy**, and `frontend` to show **Up**.
If a service exits or remains unhealthy, use the [troubleshooting steps](#docker-troubleshooting).
You can close the terminal after startup. Keep Docker running while you use the app.

Open these addresses on the same computer:

| Address | Expected result |
|---|---|
| [http://localhost](http://localhost) | The Home Catalogue interface. |
| [http://localhost/api/health](http://localhost/api/health) | JSON containing `"status": "healthy"`. This also checks the frontend-to-backend connection. |
| [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive backend API documentation. |

Ports **80** and **8000** must be available on the host. See [port conflicts](#docker-troubleshooting) if either port is occupied.
A healthy backend confirms that the app runs. It does not confirm that an AI model can process photos.

### 5. Configure one AI provider

Open **Settings → Providers and models** in the app.
Choose one of the following paths. You can skip this step for manual catalogue entry.

#### Use a cloud provider

For DeepSeek:

1. Select **DeepSeek**.
2. Enter your [DeepSeek API key](https://platform.deepseek.com/api_keys).
3. Select **Test connection**.
4. Keep `deepseek-flash` in **Vision model**.
5. Keep the initial **DeepSeek scan settings** for your first scan.
6. Select **Save and use provider**.

The **New scans use** header must now show **DeepSeek · deepseek-flash**.
The saved key takes effect immediately. No Docker restart is necessary.
See [DeepSeek settings](#deepseek) for image detail, thinking mode, and output limits.

For another cloud provider, follow [OpenRouter](#openrouter) or [OpenAI and Anthropic](#direct-openai-and-anthropic-connections).
Select an image-capable model. Cloud scans send photos and container context to that provider.

#### Use a local model

Install and start your chosen model server on the host computer.
Docker Compose does not install Ollama, LM Studio, oMLX, or their models.

For Ollama, install it from [ollama.com](https://ollama.com/download).
Start the installed app or service.
For a manual server, first confirm that Ollama is not already running.
Run `ollama serve` in a separate terminal.

Download the app's initial model:

```sh
ollama pull qwen3.5:9b
ollama list
```

Wait for the download to finish. Confirm that `qwen3.5:9b` appears in the model list.
Then configure Home Catalogue:

1. Select **Ollama** under **Providers and models**.
2. Set **Server URL** to `http://host.docker.internal:11434`.
3. Select **Test connection**.
4. Set **Vision model** to `qwen3.5:9b`.
5. Select **Save and use provider**.

Keep Ollama running while you scan.
For LM Studio or oMLX, load a vision model and enable the server API before testing the connection.
Use the [local provider URL table](#local-providers) for the server address.

Inside the backend container, `localhost` refers to that container.
Use `host.docker.internal` to reach a model server on the host computer.
If the connection fails, see [local model connection problems](#docker-troubleshooting).

### 6. Create your first catalogue and scan

1. Open **Your catalogue**.
2. Create a property and a room.
3. Open the room.
4. Upload one clear photo for the first scan.
5. Wait for analysis to finish.
6. Review the proposed items before saving them.

Leave **Settings → Scans and boxes → No boxes** selected for the first scan.
The separate object detector and embedding models are optional.
Configure them later if you need object outlines or search by meaning.

## Docker commands

Run these commands from the repository root.
Start Docker Desktop or the Docker service before running them.

| Action | Command |
|---|---|
| Start the app again | `docker compose up -d --wait` |
| Stop the app | `docker compose stop` |
| Restart the current containers | `docker compose restart` |
| Check service status | `docker compose ps` |
| Read recent logs | `docker compose logs --tail=100 backend frontend` |
| Follow new log messages | `docker compose logs -f backend frontend` |
| Rebuild after code changes | `docker compose up --build -d --wait` |
| Stop and remove the app containers | `docker compose down` |

Press **Ctrl+C** to stop following logs. This leaves the containers running.
Both `stop` and `down` preserve the repository's `storage/` folder.
Keep that folder and `.env` when you update the app.

### Apply changes to .env

Changes saved through the app's Settings page apply immediately.
After editing `.env`, recreate the containers to apply the new environment:

```sh
docker compose up -d --force-recreate --wait
```

As the [Docker restart reference](https://docs.docker.com/reference/cli/docker/compose/restart/) explains, a restart does not apply changed environment values.
Saved provider settings override their corresponding environment values.
Use **Use environment key** in Settings if you want to restore a provider's environment key.

### Update an installation

Back up your data before updating. See [Storage and backup](#storage-and-backup).
For an installation downloaded with Git, run:

```sh
git pull --ff-only
docker compose up --build -d --wait
```

If Git reports local changes or a branch conflict, resolve that issue before continuing.
After startup, open the app and confirm that your catalogue is present.

## Docker troubleshooting

| Problem | What to check |
|---|---|
| `docker` is not found | Install Docker. Open a new terminal after installation. |
| `docker compose` is unavailable | Install or update Docker Desktop, or install the Compose plugin on Linux. Use `docker compose` with a space. |
| Cannot connect to the Docker daemon | Start Docker Desktop or the Linux Docker service. Check that `docker info` succeeds. |
| Docker reports permission denied on Linux | Complete Docker's [Linux post-installation steps](https://docs.docker.com/engine/install/linux-postinstall/) for your user. |
| Compose cannot find a configuration file | Change to the folder containing `docker-compose.yml`. |
| Compose cannot find `.env` | Complete step 3 in the repository root. Check that the file is not named `.env.txt`. |
| Port 80 is already allocated | Change the frontend mapping in `docker-compose.yml` from `"80:80"` to `"8080:80"`. Run the startup command again. Open `http://localhost:8080`. |
| Port 8000 is already allocated | Change the backend mapping from `"8000:8000"` to `"8001:8000"`. Run the startup command again. API docs then use `http://localhost:8001/docs`. |
| Docker Desktop denies a folder mount | Permit Docker Desktop to access the project folder. Check file-sharing permissions, especially for an external drive. |
| The backend is unhealthy or the page returns 502 | Run `docker compose logs --tail=100 backend frontend`. Check the first startup error and storage permissions. |
| New frontend changes do not appear | Rebuild with `docker compose up --build -d --wait`. Reload the browser page after the build finishes. |
| A cloud connection works but a scan fails | Check the selected model's image support and the account balance. The connection test does not generate an image response. |

Change only the number before the colon in a port mapping.
The container ports and Nginx's internal backend address stay unchanged.
If both host ports are occupied, apply both mapping changes before starting Docker.

For a local model connection failure:

1. Confirm that the model server is running on the host computer.
2. Confirm that its model list contains the selected vision model.
3. Use the Docker URL from the [local provider table](#local-providers).
4. Check that the model server accepts connections from Docker.
5. Retry **Test connection** in Home Catalogue.

Ollama listens on `127.0.0.1` by default.
If Docker cannot reach it, configure `OLLAMA_HOST=0.0.0.0:11434` in the Ollama process or service environment.
Restart Ollama after that change. This setting belongs to Ollama, not Home Catalogue's `.env` file.
Use Ollama's [platform-specific instructions](https://docs.ollama.com/faq#how-do-i-configure-ollama-server) for macOS, Windows, or Linux.
This address allows network connections, so restrict access to a trusted network.
For LM Studio or oMLX, check the server's network binding and firewall settings.

Home Catalogue has no sign-in. Use it on a trusted network or behind an authenticated reverse proxy.

## Provider settings

### Configure the backend in Settings

Open **Settings** at `/settings`. The page has three sections:

| Section | Controls |
|---|---|
| **Providers and models** | Seven providers, server URLs, API keys, connection tests, model search, and embedding models |
| **Scans and boxes** | Box source, detector URL, detector test, image size, output limit, and Ollama context |
| **Catalogue data** | Search reindex, storage information, and catalogue reset |

To configure a provider:

1. Open **Providers and models**.
2. Select a provider.
3. For a local provider, enter its server URL.
4. Enter an API key if the provider requires one.
5. Select **Test connection**.
6. Select **Load models** if you need to refresh the list.
7. Search for a vision model, or enter its exact ID.
8. Select **Save and use provider**.

The header shows the provider and model for new scans.
Selecting a provider for editing does not activate it.
**Save provider only** stores its configuration without changing the active provider.
Saving changes to the active provider updates new scans, with either save button.

Each provider retains its own URL, model, and credential.
Draft edits remain available when you change providers or sections on this page.
Save each edited section before leaving Settings.
**Discard edits** restores the selected provider's saved configuration.

Use `host.docker.internal` to reach a host service from the Docker backend.
Use `localhost` when the backend and model server run directly on the same machine.
Settings provides buttons for these addresses.
OpenRouter, DeepSeek, OpenAI, and Anthropic use constant official HTTPS endpoints.

Local model lists can include text and embedding models. Select a model that accepts images.
OpenRouter lists image models that advertise structured output.
Connection tests send no photos and generate no inference output.
A successful connection does not prove that the selected model can process a scan.

Saved settings and keys apply without a restart.
For Docker environment changes, [recreate the containers](#apply-changes-to-env).
Install local models in Ollama, LM Studio, or oMLX before scanning.
Settings connects to these servers. It does not install models or start their processes.

### Store and replace API keys

Paste a key into **API key**, then save the provider.
**Show** shows only the key you entered. It cannot retrieve a saved key.
A blank field preserves the current key.

Use **Key action when saving** for these changes:

| Action | Result after saving |
|---|---|
| **Keep or replace key** | Keep the existing key when the field is blank. Replace it when the field contains a key. |
| **Remove key** | Remove the saved key and disable the environment key for that provider. |
| **Use environment key** | Remove the saved override and use the backend environment key. This option requires an environment key. |

Use **Save provider only** to remove a cloud key without activating an incomplete configuration.
Removing a key from the active cloud provider prevents new scans until a key is available.
For local providers, a URL change does not transfer the previous key to the new server.
Enter a key for the new server if it requires one.

The backend stores keys with runtime settings in `ai_settings.json`.
The file uses owner-only permissions (`0600`) and atomic replacement.
The file contains unencrypted keys. Protect this file and its backups.
Git ignores `ai_settings.json`. The local runtime file remains available.
Add a custom settings filename to your ignore rules if you change `AI_SETTINGS_FILE`.
The API returns key status, not key values. The UI does not store keys in browser storage.
Connection tests send draft keys in request bodies, not URLs, and do not save them.
Environment keys remain in the environment unless you enter a replacement through Settings.

Provider references: [OpenRouter authentication](https://openrouter.ai/docs/api/reference/authentication), [LM Studio authentication](https://lmstudio.ai/docs/developer/core/authentication), and [Claude model discovery](https://platform.claude.com/docs/en/api/models/list).

Home Catalogue has no sign-in. Use a trusted network or an authenticated reverse proxy.
Anyone with access to the app can change settings and use configured providers.
Use HTTPS when you access Settings across a network.

## AI providers

A vision-language model (VLM) processes an image and produces text.
Home Catalogue uses this text to propose item names, categories, tags, and containers.

### Local providers

| Provider | URL for a local backend | URL for a Docker backend |
|---|---|---|
| Ollama | `http://localhost:11434` | `http://host.docker.internal:11434` |
| LM Studio | `http://localhost:1234/v1` | `http://host.docker.internal:1234/v1` |
| oMLX | `http://localhost:8000/v1` | `http://host.docker.internal:8000/v1` |

If oMLX and the backend share a machine, assign different ports to their servers.

Select these providers through Settings. Each provider retains its own model choice.
Settings also identifies the provider and model that new scans will use.

The Docker deployment stores runtime choices and saved keys in `storage/ai_settings.json`.
Use `AI_SETTINGS_FILE` to change that path.
An existing `llava` selection remains active until you select a replacement.

### DeepSeek

To configure DeepSeek:

1. Open **Settings → Providers and models → DeepSeek**.
2. Enter a [DeepSeek API key](https://platform.deepseek.com/api_keys).
3. Select **Test connection**.
4. Keep `deepseek-flash` as the vision model.
5. Adjust **DeepSeek scan settings** if necessary.
6. Select **Save and use provider**.

You can also set `DEEPSEEK_API_KEY` and `DEEPSEEK_MODEL` in the backend environment.
For Docker environment changes, [recreate the containers](#apply-changes-to-env). A saved key overrides the environment key.
DeepSeek uses the existing key replacement, removal, and environment restoration controls.

The app sends JPEG images as base64 data URLs to `https://api.deepseek.com/chat/completions`.
Connection tests only read `/models`. They do not generate output or send photos.
The model list includes documented Flash vision IDs and excludes text models.

| DeepSeek setting | Initial value | Effect |
|---|---|---|
| Vision model | `deepseek-flash` | Processes photos. |
| Image detail | `original` | Preserves the image supplied by the app. `low` reduces it to 512 × 512. |
| Thinking mode | Disabled | Limits additional reasoning work. Enable it for comparison on difficult photos. |
| Reasoning effort | `high` | Applies when thinking is enabled. Options are `low`, `high`, and `max`. |
| Output limit | `8192` tokens | Includes thinking and inventory output. Replaces the shared output limit for DeepSeek scans. |
| JSON output | Always enabled | Sends `response_format: {"type": "json_object"}` with a schema and JSON example in the prompt. |

The maximum image edge under **Scans and boxes** still applies before upload.
DeepSeek's `high` and `auto` detail options currently have the same effect as `original`.
The backend validates JSON and rejects empty or incomplete output. An invalid inventory receives one repair attempt.
If output remains truncated, increase the DeepSeek output limit or scan a smaller area.
Scans send photos and container context to DeepSeek. Charges can apply.

These settings follow the [vision guide](https://api-docs.deepseek.com/guides/vision),
[JSON output guide](https://api-docs.deepseek.com/guides/json_mode), and
[thinking guide](https://api-docs.deepseek.com/guides/thinking_mode).

### OpenRouter

OpenRouter is available in Settings beside the local providers.

To configure OpenRouter:

1. Create an [OpenRouter API key](https://openrouter.ai/keys).
2. Open **Settings**.
3. Select **OpenRouter** under **Providers and models**.
4. Paste the key into **API key**.
5. Select **Test connection**.
6. Select a vision model.
7. Select **Save and use provider**.

You can also supply `OPENROUTER_API_KEY` through the backend environment.
For Docker environment changes, [recreate the containers](#apply-changes-to-env).
A saved key overrides the environment key.
See [API key storage](#store-and-replace-api-keys) for replacement and removal.

The connection test sends no photograph and generates no paid output.
It checks the key and model catalogue. A successful scan is still necessary to test the selected inference endpoint.

`OPENROUTER_MODEL` supplies the initial model. Its default is `google/gemini-3.8-flash`.
Compare `qwen/qwen3.8-27b` on difficult photographs.
Both advertise image input and structured outputs in the [model catalogue](https://openrouter.ai/api/v1/models).
These suggestions do not establish a measured ranking for this application.

The application requests the current model list from OpenRouter.
It excludes models for text input only, image generation, and batch requests only.
Model availability and prices can change.

**OpenRouter scans send photographs and container context outside your machine. Charges can apply.**
The optional detector continues to run locally.
OpenRouter mode uses keyword search. Local semantic search resumes when you select the local provider with its saved embedding model.

Requests use these settings:

| Setting | Purpose |
|---|---|
| `https://openrouter.ai/api/v1` | Constant API endpoint |
| Strict JSON Schema | Request the inventory structure |
| `provider.require_parameters=true` | Select endpoints that support the request parameters |
| `data_collection=deny` | Exclude providers that collect data |

The data policy can reduce endpoint availability. It does not guarantee zero retention across every service.
See the [structured output documentation](https://openrouter.ai/docs/guides/features/structured-outputs) and [provider data policies](https://openrouter.ai/docs/guides/routing/provider-selection).

The backend rejects empty and truncated completions.
It requests one replacement response when the inventory is invalid. This retry can incur another model charge.
Authentication, credit, request-limit, and provider errors do not trigger this retry.

### Direct OpenAI and Anthropic connections

Select **OpenAI** or **Anthropic** in Settings to configure a direct connection.
Enter the API key, load the model list, and select an image-capable model.
You can also use environment configuration.
`AI_PROVIDER` selects the initial provider when no saved choice exists.
A provider choice saved through Settings overrides this default for new scans.

For OpenAI, use:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o
```

For Anthropic, use:

```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-xxx
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

The key values above are placeholders.

### Initial local configuration

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=qwen3.5:9b

LMSTUDIO_BASE_URL=http://host.docker.internal:1234/v1
LMSTUDIO_MODEL=
```

These values supply the initial configuration. Saved settings override them at runtime.

## Models for 32 GB RAM

The research date is **11 September 2026**.
These recommendations address household inventory. They do not establish a measured Home Catalogue ranking.
The [model research](docs/model-research.md) contains benchmarks, alternatives, licenses, and sources.

| Use | Model | Exact Ollama tag | Published download |
|---|---|---|---:|
| Practical default | Qwen3.5 9B | `qwen3.5:9b` | 6.6 GB, Q4_K_M |
| Quality candidate | Qwen3.8 27B | `qwen3.8:27b` | 18 GB, Q4_K_M |
| Lower memory use | Qwen3.5 4B | `qwen3.5:4b` | 3.4 GB, Q4_K_M |
| Grounding comparison | Qwen3-VL 8B | `qwen3-vl:8b` | 6.1 GB, Q4_K_M |
| Alternative model family | Gemma 4 12B | `gemma4:12b` | 7.6 GB, Q4_K_M |

Grounding means locating an object in an image from its description.

The download sizes come from the [Qwen3.5](https://ollama.com/library/qwen3.5/tags), [Qwen3.8](https://ollama.com/library/qwen3.8:27b),
[Qwen3-VL](https://ollama.com/library/qwen3-vl:8b), and [Gemma 4](https://ollama.com/library/gemma4:12b) listings.

Start with Qwen3.5 9B for classification, visible labels, and container suggestions.
It leaves more memory for the detector and desktop applications.
Try Qwen3.8 27B for quality comparisons on 32 GB unified memory.
Use one request at a time and a limited context.

Use Qwen3.5 4B when GPU memory or response time limits larger models.
Compare Qwen3-VL 8B for grounding and runtime compatibility.
Compare Gemma 4 12B against Qwen on the same photographs.

### Memory limits

**Download size does not establish peak RAM use.**
A machine with 32 GB system RAM can have much less GPU VRAM.
Apple Silicon shares memory between the CPU, GPU, operating system, and applications.

Use these initial settings:

1. Select 4-bit weights.
2. Set the context to 8,192 tokens.
3. Process one request at a time.
4. Keep only one large language model loaded.
5. Check memory use before increasing the context or request count.

Avoid a 27B Q8 model on a 32 GB machine. Its weights alone approach the full memory budget.

Set these variables in the Ollama server environment:

```bash
OLLAMA_NUM_PARALLEL=1 OLLAMA_MAX_LOADED_MODELS=1 ollama serve
```

Use a separate terminal to download and inspect models:

```bash
ollama pull qwen3.5:9b
# Optional model for quality comparisons:
ollama pull qwen3.8:27b
ollama ps
```

The initial Ollama context is `8192` tokens. The initial output limit is `4096` tokens.
Change these values in **Settings → Scans and boxes → Scan limits**.
`OLLAMA_NUM_CTX` and `SCAN_MAX_TOKENS` supply the environment defaults.
It also sends `think: false`.
These settings limit memory allocation and reserve output for the inventory.
Adjust them for crowded scenes when necessary.

Set the context and thinking controls in LM Studio itself.
Larger contexts and concurrent requests consume more memory. See the [Ollama guidance](https://docs.ollama.com/faq).

### LM Studio packages

Select a vision-capable GGUF Q4_K_M or MLX 4-bit package.
Load its vision projector when required.
Use **Load models** to select the actual model ID from the server.

Example packages include:

- `lmstudio-community/Qwen3.5-9B-GGUF`
- `lmstudio-community/Qwen3.8-27B-MLX-4bit`

The [LM Studio research](docs/model-research.md#lm-studio-and-apple-silicon) lists the files and projector sizes.

## Bounding boxes

A bounding box identifies an object's location with four coordinates.
Home Catalogue offers two methods: a separate detector or direct VLM grounding.
Use **Off** when you do not need boxes.

### Detector mode

YOLOE-26 locates the object classes proposed by the VLM.
The detector runs as a separate local service. It uses CUDA when available and CPU otherwise.

Run these commands from the repository root:

```bash
cd detector
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8077
```

Then configure the application:

1. Open **Settings**.
2. Select **Detector** under **Detection mode**.
3. Enter the detector URL from the table below.
4. Select **Test detector**.
5. Select **Save detection settings**.

| Backend location | Detector URL |
|---|---|
| Docker | `http://host.docker.internal:8077` |
| Local machine | `http://localhost:8077` |

The default checkpoint is `yoloe-26s-seg.pt`.
The initial settings are `DETECTOR_CONF=0.25` and `DETECTOR_IMGSZ=960`.
These values are starting points, not calibrated thresholds.

Try `yoloe-26m-seg.pt` or `yoloe-26l-seg.pt` if the detector misses small objects.
Set `DETECTOR_MODEL=yolov8x-worldv2.pt` to use YOLO-World.
The application retains support for explicit YOLO-World selections.

YOLOE needs Ultralytics 8.4 or later.
Its first text prompt downloads a text encoder and can install CLIP.
Complete one prompted prediction before offline use.
Use `*-seg.pt` checkpoints. Prompt-free `*-seg-pf.pt` checkpoints cannot accept the scan's item classes.

The service returns boxes only. The application does not store YOLOE masks.
See the [Ultralytics documentation](https://docs.ultralytics.com/models/yoloe).

### Device support

The detector selects CUDA when available. Otherwise, it selects CPU.
`DETECTOR_DEVICE=mps` enables an experimental MPS override.
The existing YOLO-World text encoder can fail on MPS.
YOLOE also needs testing with the installed PyTorch version.

The `/health` endpoint reports the model, family, device, and image size.
It does not run a prediction.

### VLM mode

VLM mode requests boxes directly from the selected vision model. It needs no separate detector.
The prompt requires `[x1, y1, x2, y2]` coordinates on a 0–1000 scale.
The backend converts them to a 0–1 scale.

The backend rejects boxes with these properties:

- Coordinates outside the permitted range.
- Non-finite coordinates.
- Zero area.

It does not infer coordinate units from the size of a box.

### Box and image limits

A detector failure leaves the inventory available without boxes.
The application currently matches same-class detections to items by detector score.
This match does not establish which bottle or book corresponds to a detailed name.
Check repeated objects during review.

The initial maximum image edge is `1280` pixels. The backend preserves the aspect ratio.
Change **Maximum image edge** in Settings. `SCAN_MAX_EDGE` supplies its environment default.
This reduction can obscure small label details.
Use closer photographs first.
Test a maximum image edge of `1920` pixels only when sufficient memory is available.

The browser also resizes uploads.
A higher backend limit cannot recover pixels that the browser discarded.

## Processing methods

The application follows these stages:

1. Normalize image orientation.
2. Ask the VLM to propose an inventory.
3. Request boxes through the selected detection mode.
4. Check the response fields and coordinates.
5. Present the suggestions for review.
6. Save the selected results.

Detector class labels remain separate from detailed item names.
VLM confidence is a model estimate, not a calibrated probability.

| Task | Recommendation | Current support |
|---|---|---|
| Names, categories, visible text, containers | Qwen3.5 9B or Qwen3.8 27B | Available through local providers. |
| Boxes from text prompts | YOLOE-26s, with medium and large comparisons | Available in the optional detector. YOLO-World remains supported. |
| Boxes in one VLM pass | Qwen3.8 or Qwen3-VL | Available. Check small and repeated objects. |
| Dedicated optical character recognition (OCR) | PP-OCRv6 small or medium on image crops | Requires a separate integration. |
| Mask refinement | YOLOE masks, then SAM 3 or SAM 2.1 if needed | The application does not store or display masks. |
| Visual similarity search | SigLIP2 base or Qwen3-VL-Embedding-2B | Requires a separate integration. Current semantic search embeds text only. |
| Crowded shelves | Closer photographs, followed by future crop or tile processing | Automatic crops, tile merging, and crop reclassification are not available. |

The [model research](docs/model-research.md) compares these methods with Grounding DINO, Moondream, InternVL, and other candidates.
Use the same household photographs when comparing models.

Measure these properties:

- Item precision and recall.
- Duplicate counts and box overlap.
- OCR accuracy and JSON success rate.
- Response time and peak memory use.

Do not combine scores from different datasets into one ranking.

### Inventory response

Vision requests include a JSON Schema.
This example contains inventory fields for review:

```json
{
  "proposed_containers": [
    { "name": "Top Shelf", "description": "Upper wooden shelf" }
  ],
  "items": [
    {
      "name": "Olive Oil Bottle",
      "category": "Condiments",
      "tags": ["cooking", "liquid"],
      "suggested_container": "Top Shelf",
      "confidence_score": 0.92
    }
  ]
}
```

The parser checks names, field types, and finite coordinates.
Local responses can use aliases or omit optional fields.
OpenRouter requests strict output. The backend still checks the result.
An invalid inventory receives one retry.

Storage objects, such as drawers, suitcases, bins, and boxes, belong in `proposed_containers`.
Select **This is a container** during review to correct an item that should be a container.
For an existing item, select **Make container**.

## Use the catalogue

### Create a space

1. Open **Your catalogue**.
2. Enter a property name.
3. Enter a room or space name in the same form.
4. Select **Create space and continue**.
5. Add containers manually or review the containers proposed by a scan.

### Configure AI

Complete the [provider setup](#ai-providers) before your first scan.
Manual entry remains available without a model.

### Scan a room

1. Open a room or select a space through **Scan**.
2. Select **Take photo** or **Choose photos**.
3. Select the photographs to upload.
4. Keep the page open until uploads finish.
5. Monitor the preparation, upload, and analysis states.
6. Open a completed scan.

The photo library supports multiple photographs.
Analysis runs in the background after upload.

### Scan a container

1. Select a container in the room.
2. Select **Scan inside container**.
3. Upload a photograph of its contents.
4. Review the visible items proposed by the model.

### Review a scan

1. Open a completed scan.
2. Compare the names with the source photograph.
3. Clear the selection for false detections.
4. Correct categories and destinations when necessary.
5. Convert storage objects into containers when necessary.
6. Save the selected results.

You can select an excluded detection again before saving.
The server saves the review in one transaction.

Review drafts remain in the browser after a refresh when browser storage is available.
The server restores uploaded scans independently of browser drafts.

### Convert an existing item into a container

1. Open the item card.
2. Select the container icon or **edit → Make container**.
3. Complete the confirmation.

The item becomes a container in the catalogue tree.

### Search the catalogue

1. Enter a query in the header search field.
2. Select a result to open its location.

Results group by house, room, and container.

### Move items or containers

1. Select items with their checkboxes, or select the move icon for one item.
2. Select a destination room.
3. Select a destination container when required.
4. Complete the move.

Use the move icon in the container tree to move a complete container branch.

## Install as an app

Home Catalogue supports installation as a progressive web app.

| Platform | Procedure |
|---|---|
| iOS with Safari | Open **Share**. Select **Add to Home Screen**. |
| Android with Chrome | Open the browser menu. Select **Install app**. |

## Architecture

```text
homeCatalogue/
├── backend/
│   └── app/
│       ├── main.py · config.py · database.py
│       ├── models/                 # Catalogue and scan records
│       ├── schemas/                # Request and response definitions
│       ├── routers/
│       │   ├── houses.py · rooms.py · containers.py · items.py
│       │   ├── scan.py
│       │   └── settings.py         # AI settings API
│       └── services/
│           ├── ai_vision.py        # Vision analysis
│           ├── openrouter.py       # OpenRouter requests
│           ├── ai_settings_store.py
│           ├── ai_models.py        # Model lists and connection tests
│           ├── detector.py         # Detector client
│           └── search.py
├── detector/
│   ├── server.py                   # Local detection service
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Layout.jsx · Sidebar.jsx
│       │   ├── HouseList.jsx · HouseDetail.jsx
│       │   ├── RoomView.jsx        # Scan queue and item grid
│       │   ├── ReviewScan.jsx      # Scan review
│       │   ├── ItemCard.jsx · ContainerTree.jsx · MovePicker.jsx
│       │   ├── SearchBar.jsx · SearchResults.jsx
│       │   ├── Settings.jsx        # Backend settings interface
│       │   └── settings/           # Provider, scan, and catalogue controls
│       ├── hooks/ · utils/ · api/client.js
│       └── App.jsx
├── storage/
│   ├── uploads/                    # Scan images
│   ├── ai_settings.json            # Runtime settings and optional API keys
│   └── home_catalogue.db           # SQLite database
├── docker-compose.yml
├── Dockerfile.backend · Dockerfile.frontend
└── nginx.conf
```

### Catalogue relationships

```text
House (id, name, description)
  └─ Room (id, house_id, name, description)
       ├─ Container (id, room_id, parent_id, name, description)
       │    └─ Container (nested through parent_id)
       └─ Item (id, room_id, container_id, name, category, tags, image_path, confidence_score)
```

## API reference

The running backend provides [interactive API documentation](http://localhost:8000/docs).
The following tables describe the main catalogue endpoints.

### Houses

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/houses/` | List houses. |
| `POST` | `/api/houses/` | Create a house. |
| `GET` | `/api/houses/{id}` | Read a house. |
| `PUT` | `/api/houses/{id}` | Update a house. |
| `DELETE` | `/api/houses/{id}` | Delete a house. |

### Rooms

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/rooms/?house_id={id}` | List rooms. |
| `POST` | `/api/rooms/` | Create a room. |
| `GET` | `/api/rooms/{id}` | Read a room. |
| `PUT` | `/api/rooms/{id}` | Update a room. |
| `DELETE` | `/api/rooms/{id}` | Delete a room. |

### Containers

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/containers/?room_id={id}` | List containers. Add `include_all=true` for the complete tree. |
| `POST` | `/api/containers/` | Create a container. |
| `POST` | `/api/containers/{id}/move` | Move a container branch to another room. |
| `PUT` | `/api/containers/{id}` | Update a container. |
| `DELETE` | `/api/containers/{id}?delete_items={bool}` | Delete a container. Use `delete_items` to control item deletion. |

### Items

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/items/?room_id={id}&search={query}` | List or filter items. |
| `GET` | `/api/items/search?q={query}` | Search the catalogue with location context. |
| `POST` | `/api/items/` | Create an item. |
| `POST` | `/api/items/bulk` | Create multiple items from scan review. |
| `POST` | `/api/items/move` | Move items to a room or container. |
| `POST` | `/api/items/{id}/promote-to-container` | Convert an item into a container. |
| `PUT` | `/api/items/{id}` | Update an item. |
| `DELETE` | `/api/items/{id}` | Delete an item. |

### Scans

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/scan/upload` | Upload an image. Return `scan_session_id` while analysis continues in the background. |
| `GET` | `/api/scan/{session_id}` | Read scan status and results. |
| `GET` | `/api/scan/active?room_id={id}` | Restore active and unsaved scans for a room. |
| `POST` | `/api/scan/{session_id}/accept` | Save one reviewed scan in a transaction and return a reusable receipt. |
| `GET` | `/api/scan/pending/{session_id}` | List items with low confidence from a session. |

### Settings

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/settings/ai` | Read the current AI configuration. |
| `PUT` | `/api/settings/ai` | Save provider fields and optional credentials. Set `activate=false` to preserve the active provider. |
| `POST` | `/api/settings/ai/models` | List models with saved or draft credentials. Send `provider`, optional `base_url`, and optional `api_key`. |
| `POST` | `/api/settings/ai/test` | Test a provider with saved or draft credentials. No inference request occurs. |
| `GET` | `/api/settings/ai/models`, `/api/settings/ai/test` | Compatibility endpoints for saved credentials. Use `provider` and optional `base_url` query parameters. |
| `PUT` | `/api/settings/scan` | Save `scan_max_edge`, `scan_max_tokens`, and `ollama_num_ctx`. |
| `PUT` | `/api/settings/detector` | Save the box source and detector URL. |
| `GET` | `/api/settings/detector/test` | Test the detector health endpoint. |

## Storage and backup

The application stores uploaded images in `storage/uploads/` with generated filenames.
New uploads use JPEG format, normalized orientation, and no original metadata.

```text
storage/uploads/{scan_session_id}_{upload_file_id}.jpg
```

For a Docker installation, stop the app before copying the database.
Run these commands from the repository root:

```sh
docker compose stop
```

Copy the complete `storage/` folder and `.env` to a separate backup location.
Use a new dated folder for each backup. Keep the previous backup until you check the new copy.
The `storage/` folder includes the database, photos, and saved provider keys.
Protect the backup because it can contain API keys.

Start the app after the copy finishes:

```sh
docker compose up -d --wait
```

## Development

The backend uses FastAPI, SQLAlchemy, and Pydantic v2.
The frontend uses React 18 functional components, hooks, and Tailwind CSS.
SQLite stores the catalogue. `DATABASE_URL` configures the database connection.

The AI dispatch function is in `ai_vision.py`.
`ai_settings_store.py` manages runtime provider settings.
Background tasks retain scan state in `ScanSession` records.
The frontend requests `GET /api/scan/{id}` to monitor progress.

### Start a local development environment

This alternative runs the backend and frontend without Docker.
It requires Python 3.12 and Node.js 20 or later. The Docker installation above does not require these host tools.
Stop the Docker installation before using this workflow. Both workflows use the same database and port 8000.

Create `storage/uploads/` in the repository root if it does not exist.
Create a separate `backend/.env` file with these values:

```dotenv
AI_PROVIDER=ollama
DATABASE_URL=sqlite:///../storage/home_catalogue.db
UPLOAD_DIR=../storage/uploads
AI_SETTINGS_FILE=../storage/ai_settings.json
OLLAMA_BASE_URL=http://localhost:11434
RUNNING_IN_DOCKER=0
```

These paths assume that you start the backend from `backend/`.
Keep the root `.env` file for Docker. Its `/app/storage` paths do not apply to this workflow.

Use separate terminals for the backend and frontend.
Run each sequence from the repository root.

Start the backend on macOS or Linux:

```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

On Windows PowerShell, use this backend sequence:

```powershell
cd backend
py -3.12 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Start the frontend:

```bash
cd frontend
npm ci
npm run dev
```

The frontend uses `http://localhost:5173` and forwards API requests to the backend.
Use `localhost` addresses for local model servers in Settings.

### Validation

Activate the backend Python environment.
Run the backend tests from `backend/`:

```bash
python -m pytest tests -q
```

Run the frontend checks from `frontend/`:

```bash
npm test
npm run build
```

OpenRouter tests use simulated responses and temporary settings.
They do not spend credits or send personal photographs.
Detector adapter tests use model substitutes, so backend tests do not download weights.

The September 2026 implementation check ran YOLOE-26s on CPU with a synthetic blank image and an Ultralytics example photograph.
That check covered runtime compatibility and box serialization.
It did not establish household accuracy, CUDA or MPS support, or peak memory use on a 32 GB machine.
The setup tests cover all seven providers with simulated HTTP responses and temporary settings files.
They check credential replacement, endpoint binding, scan limits, pagination, and safe error responses.
Frontend tests check draft handling, model search, and credential requests.
Browser checks use a separate test database and synthetic provider responses.

Local VLM generation and paid cloud inference still require a configured service and representative photographs.

### Add an AI provider

1. Add configuration fields to `config.py`.
2. Add a processor function to `ai_vision.py`.
3. Add the processor to the dispatch in `process_image_with_ai()`.
4. Extend `Settings.jsx` and `routers/settings.py` if the provider needs interface controls.

## Environment variables

The application uses these variables for its initial configuration.
Saved settings override the relevant provider fields.
Set detector variables in the separate detector process environment.

| Variable | Default | Purpose |
|---|---|---|
| `AI_PROVIDER` | `ollama` | Select `ollama`, `lmstudio`, `openrouter`, `deepseek`, `openai`, `anthropic`, or `omlx`. |
| `OPENROUTER_API_KEY` | Empty | OpenRouter key on the backend. Recreate Docker containers after environment changes. |
| `OPENROUTER_MODEL` | `google/gemini-3.8-flash` | Initial OpenRouter model. Settings overrides it. |
| `DEEPSEEK_API_KEY` | Empty | DeepSeek key on the backend. A saved key overrides it. |
| `DEEPSEEK_MODEL` | `deepseek-flash` | Initial DeepSeek vision model. Settings overrides it. |
| `SCAN_MAX_TOKENS` | `4096` | Initial output limit. DeepSeek uses its separate output limit in Settings. |
| `OLLAMA_NUM_CTX` | `8192` | Initial context size for Ollama. Settings overrides it. |
| `SCAN_MAX_EDGE` | `1280` | Initial maximum image edge. Settings overrides it. |
| `DETECTOR_BASE_URL` | `http://host.docker.internal:8077` | Initial detector URL. Settings overrides it. |
| `DETECTOR_MODEL` | `yoloe-26s-seg.pt` | Detector checkpoint. |
| `DETECTOR_CONF` | `0.25` | Detector confidence threshold. |
| `DETECTOR_IMGSZ` | `960` | Detector inference image size. |
| `DETECTOR_DEVICE` | CUDA or CPU | Override the detector device. |
| `OPENAI_API_KEY` | Empty | OpenAI API key. |
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model name. |
| `ANTHROPIC_API_KEY` | Empty | Anthropic API key. |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | Anthropic model name. |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Initial Ollama endpoint. |
| `OLLAMA_MODEL` | `qwen3.5:9b` | Initial Ollama model. |
| `LMSTUDIO_BASE_URL` | `http://localhost:1234/v1` | LM Studio OpenAI-compatible API endpoint. |
| `LMSTUDIO_MODEL` | Empty | Initial LM Studio model ID. |
| `OMLX_BASE_URL` | `http://host.docker.internal:8000/v1` | Initial oMLX endpoint. Use a different port if the backend shares this machine. |
| `OMLX_MODEL` | `mlx-community/llava-1.5-7b-4bit` | Initial oMLX model ID. Settings overrides it. |
| `OMLX_API_KEY` | Empty | Optional oMLX environment key. A saved key overrides it. |
| `AI_SETTINGS_FILE` | `{upload_dir}/../ai_settings.json` | Runtime settings file path. |
| `RUNNING_IN_DOCKER` | Unset | Set `1` in Docker to enable host URL hints in Settings. |
| `DATABASE_URL` | `sqlite:///./home_catalogue.db` | Database connection. |
| `UPLOAD_DIR` | `/app/storage/uploads` | Image storage path. |
| `CORS_ORIGINS` | `http://localhost:5173` | Permitted CORS origins. |

## License

Application code uses the [MIT License](LICENSE).
Model and dependency licenses apply separately.
Ultralytics uses AGPL-3.0 or an Enterprise license.
See the [model research](docs/model-research.md) for model terms.
