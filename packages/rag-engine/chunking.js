const CHUNK_CHARACTERS = 1800;
const CHUNK_OVERLAP = 180;
export function chunkFiles(files) {
    const chunks = [];
    for (const file of files) {
        const text = file.content.replace(/\r\n?/g, "\n").trim();
        let start = 0;
        while (start < text.length) {
            let end = Math.min(start + CHUNK_CHARACTERS, text.length);
            if (end < text.length) {
                const boundary = Math.max(text.lastIndexOf("\n", end), text.lastIndexOf(" ", end));
                if (boundary > start + CHUNK_CHARACTERS * 0.55)
                    end = boundary;
            }
            const content = text.slice(start, end).trim();
            if (content)
                chunks.push({ content, metadata: { path: file.path } });
            if (end >= text.length)
                break;
            start = Math.max(start + 1, end - CHUNK_OVERLAP);
        }
    }
    return chunks;
}
