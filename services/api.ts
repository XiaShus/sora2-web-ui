import { AppSettings, ApiResponse } from '../types';

export const generateVideo = async (
  settings: AppSettings,
  fullPrompt: string,
  imageBase64?: string
): Promise<string> => {
  const messages: any[] = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: fullPrompt,
        },
      ],
    },
  ];

  if (imageBase64) {
    messages[0].content.push({
      type: 'image_url',
      image_url: {
        url: imageBase64,
      },
    });
  }

  const payload = {
    model: 'sora-2',
    messages: messages,
  };

  try {
    const response = await fetch(settings.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': settings.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data: ApiResponse = await response.json();
    
    // The API returns the video URL inside a markdown link format in the content string
    // Example: "[download video](https://...)"
    const content = data.choices?.[0]?.message?.content || "";
    const urlMatch = content.match(/\((https:\/\/.*?)\)/);

    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    } else {
      // Fallback: Check if the content itself is a URL or handle unexpected format
      if (content.startsWith('http')) return content;
      throw new Error("Could not parse video URL from response: " + content);
    }

  } catch (error: any) {
    console.error("Generation failed:", error);
    throw error;
  }
};
