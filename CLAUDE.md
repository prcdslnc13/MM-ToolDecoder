## Agent Instructions
1. First think through the problem, read the codebase for the relevant files or resources.
2. Before you make any major changes check in with me and I will verify the plan.
3. Give a high level explanation of the changes you make every step of the way.
4. Make every task and code change as simple as possible. Avoid making massive or complex changes. Every change should impact as little code as possible. Maintain simplicity everywhere possible.
5. Maintain a documentation file that describes how the architecture of the app works inside and out.
6. Never speculate about code or files you have not opened. If the user references a specific file, you MUST read the file before answering. Make sure to investigate and read relevant files BEFORE answering or making changes to the codebase. Never make any claims about the code before investigating unless you are certain of the correct answer. Give grounded and hallucination-free answers.
7. Create and add/update an html docs site in the parent project that matches the planning and requirements we are building here for a more visually friendly and navigatable reflection of the overview, planning/project plan, requirements, architecture, services, schema and frontend.  So if you are updating the markdown files you should also be updating the html if applicable.
8. Whenever work is done on a service that has a Dockerfile, a Docker tar package should always be built as part of the deliverable. Deployment targets are Vercel and Docker Desktop. Every build must be dual-tagged with both the semantic version from package.json (e.g., 1.2.3) and latest, with both tags pointing to the same image. The tar export must contain both tags so that the recipient can load either one. Image names should use a short, readable name rather than the full repo directory name — for example, mm-tool-decoder instead of mm-tooldecoder-app. The tar file name should match the image name (e.g., mm-tool-decoder.tar). This CLAUDE.md should document the image name mapping so there's no ambiguity about what an image is called.


## Docker Image — This Repo

| package.json `name` | Docker image name  | Tar file name       |
|---------------------|--------------------|---------------------|
| `mm-tool-decoder`   | `mm-tool-decoder`  | `mm-tool-decoder.tar` |

**Build command (dual-tagged):**
```bash
VERSION=$(node -p "require('./package.json').version")
docker build -t mm-tool-decoder:${VERSION} -t mm-tool-decoder:latest .
docker save mm-tool-decoder:${VERSION} mm-tool-decoder:latest -o mm-tool-decoder.tar
```
Both tags must be included in the same `docker save` so the recipient can `docker load` either one.

## MillMage Data Rules

> **MillMage always stores feedrates as mm/s**, regardless of the tool units or input units.