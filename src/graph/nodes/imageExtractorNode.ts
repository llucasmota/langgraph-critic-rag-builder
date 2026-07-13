import fs from 'fs/promises';
import path from 'path';
import type { Runtime } from '@langchain/langgraph';
import type { GraphState } from '../graph.ts';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function getExtension(niche?: string, code?: string): string {
  if (niche === 'flutter_dart') return 'dart';
  if (niche === 'ai_engineering') {
    if (code && (code.includes('import ') || code.includes('def ') || code.includes('print(')) && !code.includes('console.log')) {
      return 'py';
    }
    return 'ts';
  }
  return 'ts';
}

export function createImageExtractorNode() {
  return async (state: GraphState, runtime?: Runtime): Promise<Partial<GraphState>> => {
    console.log("\n[Image Extractor] Preparing final package...");
    console.log("[Image Extractor] Snippets in state:", JSON.stringify(state.codeSnippets, null, 2));
    
    let folderName = state.suggestedFolderSlug ? slugify(state.suggestedFolderSlug) : slugify(state.initialCommand || 'generated-post');
    if (folderName.length > 20) {
      folderName = folderName.substring(0, 20).replace(/-+$/, '');
    }
    const outputDir = path.join(process.cwd(), 'output', folderName);
    await fs.mkdir(outputDir, { recursive: true });

    if (state.niche === 'out_of_scope') {
      console.warn("[Image Extractor] Command classified as OUT OF SCOPE.");
      const textPath = path.join(outputDir, 'error_report.txt');
      const errorMsg = `The provided command is out of the technical scope supported by this application.
Received command: "${state.initialCommand}"
Classified niche: "out_of_scope"
Valid niche names: "flutter_dart", "node_react", "ai_engineering".`;
      await fs.writeFile(textPath, errorMsg, 'utf-8');
      console.log(`[+] Error report saved to: ${textPath}`);
      console.log("\n✅ Process finished! Check the /output directory.\n");
      return { reviewCount: 0 };
    }

    if (state.finalPostText) {
      const hashtagsStr = state.hashtags ? `\n\n${state.hashtags.join(' ')}` : '';
      const textPath = path.join(outputDir, 'linkedin_post.txt');
      await fs.writeFile(textPath, `${state.finalPostText}${hashtagsStr}`, 'utf-8');
      console.log(`[+] Post text saved: ${textPath}`);
    } else if (state.technicalDraft) {
      // If forced to exit due to revision limit without final approval, save the last draft with a warning
      const textPath = path.join(outputDir, 'linkedin_post.txt');
      const warningStr = `⚠️ WARNING: This post did not pass all Reviewer audits (limit of 3 reviews reached).\n` +
        `Verify and correct the technical information before publishing.\n\n` +
        `Last Draft:\n${state.technicalDraft}`;
      await fs.writeFile(textPath, warningStr, 'utf-8');
      console.log(`[+] Draft saved (review limit reached): ${textPath}`);
    }

    if (state.codeSnippets && state.codeSnippets.length > 0) {
      for (let i = 0; i < state.codeSnippets.length; i++) {
        let codeContent = state.codeSnippets[i];
        // Remove prefixes like [CODE_SNIPPET_1] that the LLM might have incorrectly included at the start of the code
        codeContent = codeContent.replace(/^\[CODE_SNIPPET_\d+\]\s*/i, '');
        const ext = getExtension(state.niche, codeContent);
        
        // Save the original source code as text
        const codePath = path.join(outputDir, `snippet_${i + 1}.${ext}`);
        await fs.writeFile(codePath, codeContent, 'utf-8');
        console.log(`[+] Source code saved: ${codePath}`);

        try {
          const response = await fetch('https://carbonara.solopov.dev/api/cook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: codeContent,
              backgroundColor: "rgba(171, 184, 195, 1)",
              theme: "dracula", windowTheme: "mac", dropShadow: true,
              paddingVertical: "56px", paddingHorizontal: "56px"
            })
          });

          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const imgPath = path.join(outputDir, `snippet_${i + 1}.png`);
            await fs.writeFile(imgPath, Buffer.from(buffer));
            console.log(`[+] Code image saved: ${imgPath}`);
          } else {
            console.warn(`[-] HTTP error from Carbonara API for snippet ${i + 1}: ${response.status} - ${response.statusText}`);
          }
        } catch (e) {
           console.error(`[-] Error generating image ${i+1}`, e);
        }
      }
    }
    console.log("\n✅ Process finished! Check the /output directory.\n");
    return { reviewCount: 0 };
  };
}
