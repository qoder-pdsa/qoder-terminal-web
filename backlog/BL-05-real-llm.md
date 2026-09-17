# BL-05 · 真实 LLM provider

- **Repo**: qoder-terminal-analyst
- **Depends on**: 无
- **建议小队**: 标准自动化交付

## 验收标准
- [ ] `llm/openai_compatible.py` 实现 `LLMProvider`：plan 使用 tool calling，summarize 输出 markdown
- [ ] `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY` 配置，可接百炼 Qwen 等 OpenAI 兼容接口
- [ ] `LLM_PROVIDER=openai_compatible` 且缺少 key 时启动失败并给出明确错误
- [ ] 单测用 `httpx.MockTransport` 模拟模型响应，含一次工具调用往返
- [ ] 默认仍为 `stub`
