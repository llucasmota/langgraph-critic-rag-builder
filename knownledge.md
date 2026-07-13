# Agentic Workflow para o LinkedIn: Arquitetura e Prompts

Este documento detalha a arquitetura, o fluxo de dados e os prompts de sistema de um ecossistema multi-agentes projetado para gerar publicações técnicas de alto nível no LinkedIn.

---

## 1. Visão Geral do Sistema
Um sistema multi-agentes baseado em **LangGraph** focado em gerar posts técnicos de altíssima qualidade em **Inglês (US)**.

*   **Estratégia de SSI (Social Selling Index):** O sistema não publica diretamente via API. Ele gera os artefatos (texto e imagens do código) em uma pasta local (`/output`) para publicação manual (*Human-in-the-Loop*), evitando penalizações de automação pela plataforma.
*   **Tech Stack:** Node.js, `@langchain/langgraph` (orquestração), `zod` (Structured Outputs), `OpenRouter` (roteamento de LLMs), `Pinecone` + `@langchain/google-genai` (RAG via `embedding-001`), e API do `Carbonara` (geração de imagens de código).

---

## 2. O Estado do Grafo (State Schema)
O objeto que transita entre todos os nós do sistema:

*   `initialCommand`: O pedido original do usuário.
*   `niche`: Classificação do tema (`flutter_dart`, `node_react` ou `ai_engineering`).
*   `ragContext`: Conhecimento profundo extraído do banco vetorial.
*   `mcpContext`: Dados de documentação ao vivo (opcional).
*   `technicalDraft`: O texto cru escrito pelo especialista.
*   `codeSnippets`: Array isolando os blocos de código.
*   `reviewFeedback`: Apontamentos de correção do Revisor.
*   `finalPostText`: O texto polido e formatado para o LinkedIn.
*   `hashtags`: Array com as hashtags selecionadas.
*   `reviewCount`: Contador de loops de revisão (Guardrail: limite de 3 tentativas).

---

## 3. Arquitetura de Roteamento (Edge Conditions)
1.  **Entrada:** O comando vai para o `Orquestrador`.
2.  **Roteador de Nicho:** Avalia o `niche` e direciona para o Especialista correspondente.
3.  **Loop de Revisão:** Todo especialista envia o rascunho para o `Revisor`.
    *   *Reprovado:* O fluxo volta para o Especialista com o `reviewFeedback` e o `reviewCount` sobe +1.
    *   *Aprovado (ou limite estourado):* O fluxo avança para o `Extrator de Imagens`.
4.  **Saída:** O `Extrator de Imagens` salva tudo na máquina local e encerra o fluxo.

---

## 4. Catálogo de Agentes e System Prompts

### A. Agente Orquestrador (O Despachante)
*   **Responsabilidade:** Analisar a intenção do usuário e classificar o tema estritamente em uma das três categorias via Structured Outputs.
*   **System Prompt:**
    ```text
    You are a Technical Dispatcher for an automated LinkedIn content creation system. Your only job is to analyze the user's initial command and classify it into one of three specific technical niches: 'flutter_dart', 'node_react', or 'ai_engineering'. Focus on the core architectural intent. Output your reasoning and the exact niche.
    ```

### B. Agentes Especialistas (Os Engenheiros)
*   **Responsabilidade:** Consumir o RAG e escrever a matéria-prima técnica pura, densa e com código funcional.
*   **Mecânica de Código:** Nunca misturar código no texto markdown. Usar `[CODE_SNIPPET_X]` no texto e popular a variável `codeSnippets` com o código cru.

**Prompt: Especialista em Flutter/Dart**
```text
You are a Senior Mobile & Full Stack Software Engineer specializing in Flutter and Dart. 
Persona: Pragmatic executor, over 6 years experience. PROHIBITED: Never use 'Tech Lead' or management titles. 
Task: Write a deep, technical draft in professional US English about the given topic. Focus on architecture and under-the-hood concepts. 
Code Separation: Replace actual code with [CODE_SNIPPET_X] in the text, and put the raw compilable Dart code in the 'codeSnippets' array.