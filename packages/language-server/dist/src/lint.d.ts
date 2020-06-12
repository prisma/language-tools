export interface LinterError {
    start: number;
    end: number;
    text: string;
}
export default function lint(execPath: string, text: string, onError?: (errorMessage: string) => void): Promise<LinterError[]>;
