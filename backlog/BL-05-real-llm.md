# BL-05 · Real LLM Provider

- **Repo**: qoder-terminal-analyst
- **Depends on**: none
- **Squad**: Standard Automated Delivery

## Acceptance criteria
- [ ] `llm/openai_compatible.py` implements `LLMProvider`: plan uses tool calling, summarize outputs Markdown
- [ ] Configured via `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY`, working with OpenAI-compatible APIs such as Alibaba Cloud Model Studio Qwen
- [ ] With `LLM_PROVIDER=openai_compatible` and no key, startup fails with a clear error
- [ ] Unit tests mock model responses with `httpx.MockTransport`, including one tool-call round trip
- [ ] The default remains `stub`
