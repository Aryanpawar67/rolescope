import Anthropic from "@anthropic-ai/sdk";
import { AzureOpenAI } from "openai";

export type ModelId =
  | "azure-gpt-4o"
  | "azure-gpt-5.3"
  | "azure-oss-120b"
  | "claude-sonnet-4-6";

export const DEFAULT_MULTI_MODELS: ModelId[] = [
  "azure-gpt-4o",
  "azure-gpt-5.3",
  "azure-oss-120b",
];

export const MODEL_LABELS: Record<ModelId, string> = {
  "azure-gpt-4o": "GPT-4o",
  "azure-gpt-5.3": "GPT-5.3",
  "azure-oss-120b": "OSS 120B",
  "claude-sonnet-4-6": "Claude Sonnet",
};

export interface CompletionInput {
  prompt: string;
  maxTokens?: number;
}

export interface CompletionResult {
  text: string;
  modelId: ModelId;
}

const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

let _azureClient: AzureOpenAI | null = null;
function getAzureClient(): AzureOpenAI {
  if (!_azureClient) {
    _azureClient = new AzureOpenAI({
      endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
      apiKey: process.env.AZURE_OPENAI_API_KEY!,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION!,
    });
  }
  return _azureClient;
}

const AZURE_DEPLOYMENT_MAP: Record<string, string | undefined> = {
  "azure-gpt-4o": process.env.AZURE_OPENAI_DEPLOYMENT_GPT4O,
  "azure-gpt-5.3": process.env.AZURE_OPENAI_DEPLOYMENT_GPT53,
  "azure-oss-120b": process.env.AZURE_OPENAI_DEPLOYMENT_OSS120B,
};

function getAzureDeployment(modelId: ModelId): string {
  const deployment = AZURE_DEPLOYMENT_MAP[modelId];
  if (!deployment) throw new Error(`No Azure deployment configured for model: ${modelId}`);
  return deployment;
}

export async function callModel(
  modelId: ModelId,
  input: CompletionInput
): Promise<CompletionResult> {
  const maxTokens = input.maxTokens ?? 16384;

  if (modelId === "claude-sonnet-4-6") {
    const message = await anthropicClient.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: input.prompt }],
    });
    const text = message.content[0].type === "text" ? message.content[0].text : "";
    return { text, modelId };
  }

  const azure = getAzureClient();
  const deployment = getAzureDeployment(modelId);
  const completion = await azure.chat.completions.create({
    model: deployment,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: input.prompt }],
  });
  const text = completion.choices[0]?.message?.content ?? "";
  return { text, modelId };
}
