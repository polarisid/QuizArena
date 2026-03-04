'use server';
/**
 * @fileOverview A Genkit flow that generates a quiz question, four alternatives (one correct),
 * a recommended time limit, and base points based on a provided topic.
 *
 * - generateQuizQuestionsFromTopic - The main function to call the AI quiz question generator.
 * - GenerateQuizQuestionsFromTopicInput - The input type for the function.
 * - GenerateQuizQuestionsFromTopicOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateQuizQuestionsFromTopicInputSchema = z.object({
  topic: z.string().describe('The topic for which to generate a quiz question.'),
});
export type GenerateQuizQuestionsFromTopicInput = z.infer<typeof GenerateQuizQuestionsFromTopicInputSchema>;

const GenerateQuizQuestionsFromTopicOutputSchema = z.object({
  question: z.string().describe('The generated quiz question.'),
  alternatives: z
    .array(z.string())
    .length(4)
    .describe('An array containing exactly four alternative answers.'),
  correctAnswerIndex: z
    .number()
    .min(0)
    .max(3)
    .describe(
      'The zero-based index (0-3) of the correct answer within the alternatives array.'
    ),
  timeLimitSeconds: z
    .number()
    .min(5)
    .max(120)
    .describe('The recommended time limit in seconds for answering the question.'),
  basePoints: z
    .number()
    .min(500)
    .max(5000)
    .describe('The base points for this question based on its difficulty (usually 1000).'),
});
export type GenerateQuizQuestionsFromTopicOutput = z.infer<typeof GenerateQuizQuestionsFromTopicOutputSchema>;

export async function generateQuizQuestionsFromTopic(
  input: GenerateQuizQuestionsFromTopicInput
): Promise<GenerateQuizQuestionsFromTopicOutput> {
  return generateQuizQuestionsFromTopicFlow(input);
}

const quizQuestionPrompt = ai.definePrompt({
  name: 'quizQuestionPrompt',
  input: { schema: GenerateQuizQuestionsFromTopicInputSchema },
  output: { schema: GenerateQuizQuestionsFromTopicOutputSchema },
  prompt: `You are an expert quiz question generator. Your task is to create one multiple-choice quiz question based on the provided topic.

Generate exactly one question with four distinct alternative answers. One of the alternatives must be the correct answer. Also, provide a reasonable time limit in seconds and base points (500 to 5000) reflecting the difficulty.

Ensure the output is a JSON object matching the following structure:
{
  "question": "string",
  "alternatives": [
    "string",
    "string",
    "string",
    "string"
  ],
  "correctAnswerIndex": "number" (0-3),
  "timeLimitSeconds": "number" (e.g., 30),
  "basePoints": "number" (e.g., 1000)
}

Topic: {{{topic}}}`,
});

const generateQuizQuestionsFromTopicFlow = ai.defineFlow(
  {
    name: 'generateQuizQuestionsFromTopicFlow',
    inputSchema: GenerateQuizQuestionsFromTopicInputSchema,
    outputSchema: GenerateQuizQuestionsFromTopicOutputSchema,
  },
  async (input) => {
    const { output } = await quizQuestionPrompt(input);
    if (!output) {
      throw new Error('Failed to generate quiz question.');
    }
    return output;
  }
);
