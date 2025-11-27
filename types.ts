export enum TaskStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export interface AppSettings {
  apiUrl: string;
  apiKey: string;
}

export interface GenerationTask {
  id: string;
  createdAt: number;
  prefix: string;
  prompt: string;
  suffix: string;
  padImageBase64?: string;
  status: TaskStatus;
  videoUrl?: string;
  errorMsg?: string;
}

export interface ApiResponseChoice {
  message: {
    content: string;
  };
}

export interface ApiResponse {
  id: string;
  choices: ApiResponseChoice[];
}
