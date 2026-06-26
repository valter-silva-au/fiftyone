import { vi, describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("../util", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../util")>();

  return {
    ...actual,
    doPatchSample: vi.fn(),
  };
});

vi.mock("@fiftyone/state", () => ({
  generatedDatasetName: "generatedDatasetName",
  isGeneratedView: "isGeneratedView",
  useCurrentDatasetId: vi.fn(),
  useModalInteractionSample: vi.fn(),
  useRefreshSample: vi.fn(),
}));

vi.mock("recoil", () => ({
  useRecoilValue: vi.fn(),
}));

import { doPatchSample } from "../util";
import { usePatchSample, usePatchSampleWith } from "./usePatchSample";
import type { Sample } from "@fiftyone/looker";
import type { JSONDeltas } from "@fiftyone/core/src/client";
import {
  generatedDatasetName,
  isGeneratedView,
  useCurrentDatasetId,
  useModalInteractionSample,
  useRefreshSample,
} from "@fiftyone/state";
import { useRecoilValue } from "recoil";

const SAMPLE: Sample = { id: "sample-1" } as Sample;
const INTERACTION_SAMPLE = {
  _id: "interaction-sample-1",
  id: "interaction-sample-1",
  filepath: "/tmp/sample.png",
  last_modified_at: { datetime: Date.UTC(2026, 0, 1) },
  metadata: { height: 100, width: 100 },
  tags: [],
  _media_type: "image",
} as unknown as Sample;
const DATASET_ID = "dataset-1";
const VERSION_TOKEN = "tok-abc";
const DELTAS: JSONDeltas = [
  { path: "/label", value: "cat", op: "replace" },
] as any;

function makeArgs(overrides = {}) {
  return {
    sample: SAMPLE,
    datasetId: DATASET_ID,
    getVersionToken: vi.fn().mockReturnValue(VERSION_TOKEN),
    refreshSample: vi.fn(),
    isGenerated: false,
    generatedDatasetName: null,
    ...overrides,
  };
}

describe("usePatchSampleWith", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(doPatchSample).mockResolvedValue(true);
    vi.mocked(useModalInteractionSample).mockReturnValue(INTERACTION_SAMPLE);
    vi.mocked(useCurrentDatasetId).mockReturnValue(DATASET_ID);
    vi.mocked(useRefreshSample).mockReturnValue(vi.fn());
    vi.mocked(useRecoilValue).mockImplementation((key) => {
      if (key === isGeneratedView) {
        return false;
      }
      if (key === generatedDatasetName) {
        return null;
      }
      return null;
    });
  });

  it("delegates to doPatchSample with the provided sample and deltas", async () => {
    const args = makeArgs();
    const { result } = renderHook(() => usePatchSampleWith(args));

    await result.current(DELTAS);

    expect(doPatchSample).toHaveBeenCalledWith(
      expect.objectContaining({
        sample: SAMPLE,
        datasetId: DATASET_ID,
        sampleDeltas: DELTAS,
      }),
    );
  });

  it("passes all constructor args through to doPatchSample", async () => {
    const args = makeArgs({
      isGenerated: true,
      generatedDatasetName: "gen-ds",
    });
    const { result } = renderHook(() => usePatchSampleWith(args));

    await result.current(DELTAS);

    expect(doPatchSample).toHaveBeenCalledWith(
      expect.objectContaining({
        isGenerated: true,
        generatedDatasetName: "gen-ds",
        getVersionToken: args.getVersionToken,
        refreshSample: args.refreshSample,
      }),
    );
  });

  it("passes patchOptions to doPatchSample", async () => {
    const { result } = renderHook(() => usePatchSampleWith(makeArgs()));

    await result.current(DELTAS, {
      labelId: "l-1",
      labelPath: "predictions",
      opType: "mutate",
    });

    expect(doPatchSample).toHaveBeenCalledWith(
      expect.objectContaining({
        labelId: "l-1",
        labelPath: "predictions",
        opType: "mutate",
      }),
    );
  });

  it("passes undefined for unspecified patchOptions fields", async () => {
    const { result } = renderHook(() => usePatchSampleWith(makeArgs()));

    await result.current(DELTAS);

    expect(doPatchSample).toHaveBeenCalledWith(
      expect.objectContaining({
        labelId: undefined,
        labelPath: undefined,
        opType: undefined,
      }),
    );
  });

  it("returns true when doPatchSample succeeds", async () => {
    vi.mocked(doPatchSample).mockResolvedValue(true);
    const { result } = renderHook(() => usePatchSampleWith(makeArgs()));

    expect(await result.current(DELTAS)).toBe(true);
  });

  it("returns false when doPatchSample fails", async () => {
    vi.mocked(doPatchSample).mockResolvedValue(false);
    const { result } = renderHook(() => usePatchSampleWith(makeArgs()));

    expect(await result.current(DELTAS)).toBe(false);
  });

  it("propagates errors from doPatchSample", async () => {
    vi.mocked(doPatchSample).mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => usePatchSampleWith(makeArgs()));

    await expect(result.current(DELTAS)).rejects.toThrow("network error");
  });

  it("uses the modal interaction sample and matching version token by default", async () => {
    const { result } = renderHook(() => usePatchSample());

    await result.current(DELTAS);

    expect(doPatchSample).toHaveBeenCalledWith(
      expect.objectContaining({
        sample: INTERACTION_SAMPLE,
        datasetId: DATASET_ID,
        sampleDeltas: DELTAS,
      })
    );
    const [{ getVersionToken }] = vi.mocked(doPatchSample).mock.calls[0];
    expect(getVersionToken()).toBe("2026-01-01T00:00:00.000");
  });
});
