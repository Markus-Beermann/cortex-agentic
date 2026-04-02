import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { LinkedInPhotoExtractor } from "../../src/hermes/linkedin-photo-extractor";

const temporaryDirectories: string[] = [];

describe("LinkedInPhotoExtractor", () => {
  afterEach(async () => {
    for (const directoryPath of temporaryDirectories.splice(0)) {
      await rm(directoryPath, { recursive: true, force: true });
    }
  });

  it("extracts a screenshot into a feed item and stores it", async () => {
    const directoryPath = await mkdtemp(path.join(os.tmpdir(), "hermes-linkedin-"));
    temporaryDirectories.push(directoryPath);

    const imagePath = path.join(directoryPath, "feedback.png");
    await writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const extractor = new LinkedInPhotoExtractor(
      {
        generateStructured: vi.fn().mockResolvedValue({
          author: "Jane Doe",
          text: "Please add export support.",
          timestampText: "2h",
          context: "Comment on launch post"
        })
      } as never,
      {
        upsert: vi.fn().mockResolvedValue(true),
        listSince: vi.fn()
      },
      {
        tag: vi.fn().mockResolvedValue(["feature_request"])
      }
    );

    const result = await extractor.ingest({
      imagePath,
      context: "Screenshot from LinkedIn mobile app"
    });

    expect(result.inserted).toBe(true);
    expect(result.item.source).toBe("linkedin");
    expect(result.item.eventType).toBe("linkedin.post");
    expect(result.item.tags).toEqual(["feature_request"]);
    expect(result.item.contentJson).toMatchObject({
      author: "Jane Doe",
      text: "Please add export support."
    });
  });
});
