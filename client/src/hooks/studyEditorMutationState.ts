interface OpenStudyCardEditorOptions {
  resetAudioMutation: () => void;
  resetUpdateMutation: () => void;
  setEditing: (editing: boolean) => void;
}

const openStudyCardEditor = (options: OpenStudyCardEditorOptions) => {
  options.resetUpdateMutation();
  options.resetAudioMutation();
  options.setEditing(true);
};

export default openStudyCardEditor;
