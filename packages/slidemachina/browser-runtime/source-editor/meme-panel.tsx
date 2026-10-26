import { useEffect, useState, type FormEvent } from "react";
import { isSourceEditProblemCode, pickEditorTexts, type EditorTexts } from "./editor-texts.ts";
import { sendSourceEdit, SourceEditFailure } from "./source-edit-requests.ts";
import { memeSearchEndpoint } from "../../shared-between-runtimes/engine-constants.js";
import type { MemeKind, MemeSearchAnswer } from "../../shared-between-runtimes/meme-template.js";
import { readPositionFromHash } from "../slide-navigation/position-hash.ts";

type PanelStatus = { statusTone: "progress" | "problem"; statusText: string };

// Typing pauses this long before a search: GIPHY counts every request against its hourly limit.
const searchDelay = 350;

function describeProblem(editorTexts: EditorTexts, problemCode: string): PanelStatus {
  return { statusTone: "problem", statusText: editorTexts.problems[isSourceEditProblemCode(editorTexts, problemCode) ? problemCode : "writeFailed"] };
}

// The meme panel of slidemachina dev: memegen templates, GIPHY clips and links go on a new slide after the shown one.
export default function MemePanel({ languageCode, closePanel }: { languageCode: string; closePanel: () => void }) {
  const editorTexts = pickEditorTexts(languageCode);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchAnswer, setSearchAnswer] = useState<MemeSearchAnswer>();
  const [linkText, setLinkText] = useState("");
  const [panelStatus, setPanelStatus] = useState<PanelStatus>();
  const [shownTab, setShownTab] = useState<"templates" | "clips">("templates");

  useEffect(() => {
    const searchController = new AbortController();
    const searchTimer = setTimeout(() => {
      setPanelStatus({ statusTone: "progress", statusText: editorTexts.memeSearching });
      fetch(`${memeSearchEndpoint}?${new URLSearchParams({ query: searchQuery }).toString()}`, { signal: searchController.signal })
        .then(async (searchResponse) => {
          const answerBody = (await searchResponse.json()) as MemeSearchAnswer & { problemCode?: string };
          if (answerBody.problemCode !== undefined) throw new SourceEditFailure(answerBody.problemCode);
          setSearchAnswer(answerBody);
          setPanelStatus(undefined);
        })
        .catch((searchFailure: unknown) => {
          if (searchController.signal.aborted) return;
          setPanelStatus(describeProblem(editorTexts, searchFailure instanceof SourceEditFailure ? searchFailure.problemCode : "serverUnreachable"));
        });
    }, searchDelay);
    return () => {
      clearTimeout(searchTimer);
      searchController.abort();
    };
  }, [searchQuery, editorTexts]);

  // The new slide comes back as a hot update; the panel closes and the presentation moves on to it.
  const insertMeme = async (memeKind: MemeKind, memeValue: string) => {
    const slideLocation = document.querySelector<HTMLElement>("[data-canvas] > [data-slide][data-current]")?.dataset.sourceLocation;
    if (slideLocation === undefined) {
      setPanelStatus({ statusTone: "problem", statusText: editorTexts.memeNeedsSlide });
      return;
    }
    setPanelStatus({ statusTone: "progress", statusText: editorTexts.memeInserting });
    try {
      await sendSourceEdit({ editKind: "meme", sourceLocation: slideLocation, memeKind, memeValue });
      window.location.assign(`#${readPositionFromHash().slideIndex + 2}`);
      closePanel();
    } catch (insertFailure) {
      setPanelStatus(describeProblem(editorTexts, insertFailure instanceof SourceEditFailure ? insertFailure.problemCode : "writeFailed"));
    }
  };

  const submitLink = (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    if (linkText.trim() !== "") void insertMeme("link", linkText.trim());
  };

  const memeTemplates = searchAnswer?.memeTemplates ?? [];
  const giphyClips = searchAnswer?.giphyClips ?? [];
  return (
    <dialog open data-meme-panel aria-label={editorTexts.memeButton}>
      <input
        data-meme-search
        type="search"
        value={searchQuery}
        placeholder={editorTexts.memeSearchPlaceholder}
        aria-label={editorTexts.memeSearchPlaceholder}
        autoFocus
        spellCheck={false}
        onChange={(changeEvent) => setSearchQuery(changeEvent.target.value)}
      />
      <div data-meme-tabs role="tablist">
        <button type="button" role="tab" aria-selected={shownTab === "templates"} onClick={() => setShownTab("templates")}>
          {editorTexts.memeTemplatesTitle}
          {searchAnswer !== undefined && <span data-meme-count>{memeTemplates.length}</span>}
        </button>
        <button type="button" role="tab" aria-selected={shownTab === "clips"} onClick={() => setShownTab("clips")}>
          {editorTexts.memeClipsTitle}
          {searchAnswer?.isGiphyOn === true && <span data-meme-count>{giphyClips.length}</span>}
        </button>
        {shownTab === "clips" && <span data-giphy-attribution>{editorTexts.giphyAttribution}</span>}
      </div>
      <div data-meme-results role="tabpanel">
        {shownTab === "templates" && searchAnswer !== undefined && memeTemplates.length === 0 && <p data-meme-note>{editorTexts.memeNothingFound}</p>}
        {shownTab === "clips" && searchAnswer?.isGiphyOn === false && <p data-meme-note>{editorTexts.giphyOff}</p>}
        <div data-meme-grid>
          {shownTab === "templates" &&
            memeTemplates.map((memeTemplate) => (
              <button key={memeTemplate.templateId} type="button" data-meme-tile title={memeTemplate.templateId} onClick={() => void insertMeme("template", memeTemplate.templateId)}>
                <img src={memeTemplate.previewAddress} alt="" loading="lazy" />
                <span>{memeTemplate.templateName}</span>
              </button>
            ))}
          {shownTab === "clips" &&
            giphyClips.map((giphyClip) => (
              <button key={giphyClip.clipId} type="button" data-meme-tile title={giphyClip.clipTitle} onClick={() => void insertMeme("clip", giphyClip.clipId)}>
                <img src={giphyClip.previewAddress} alt={giphyClip.clipTitle} loading="lazy" />
              </button>
            ))}
        </div>
      </div>
      <p data-meme-hint>{editorTexts.memePlacementHint}</p>
      <form data-meme-link onSubmit={submitLink}>
        <input type="url" value={linkText} placeholder={editorTexts.memeLinkPlaceholder} aria-label={editorTexts.memeLinkPlaceholder} onChange={(changeEvent) => setLinkText(changeEvent.target.value)} />
        <button type="submit" disabled={linkText.trim() === ""}>
          {editorTexts.memeLinkButton}
        </button>
      </form>
      {panelStatus !== undefined && (
        <output data-meme-status={panelStatus.statusTone} aria-live="polite">
          {panelStatus.statusText}
        </output>
      )}
    </dialog>
  );
}
