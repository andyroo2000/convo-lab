import { useState } from 'react';
import type { FeatureAudience, AccessGroup } from './api';
import AudienceEditor from './AudienceEditor';

interface Props {
  audience?: FeatureAudience;
  groups: AccessGroup[];
  label: string;
  global: boolean;
  onSaved: (audience: FeatureAudience) => void;
  onGroupSaved: (group: AccessGroup) => void;
}
function audienceSummary(audience: FeatureAudience | undefined, groups: AccessGroup[]) {
  const selectedGroups = groups.filter((group) => audience?.groupIds.includes(group.id));
  const names = [
    ...(audience?.users.map((user) => user.name || user.email) ?? []),
    ...selectedGroups.map((group) => group.name),
  ];
  const summary =
    names.slice(0, 4).join(', ') + (names.length > 4 ? ` and ${names.length - 4} more` : '');
  return audience ? summary || 'No selected users or groups' : 'Audience not loaded';
}
const FeatureAudienceControls = (props: Props) => {
  const [open, setOpen] = useState(false);
  const { audience, groups, label, global, onSaved } = props;
  return (
    <div className="feature-audience-controls">
      <h4>Selected users & groups</h4>
      <p>{audienceSummary(audience, groups)}</p>
      <button
        type="button"
        disabled={!audience}
        aria-label={`Edit audience for ${label}`}
        onClick={(event) => {
          event.currentTarget.focus();
          setOpen(true);
        }}
      >
        Edit audience
      </button>
      <p className="access-hint">
        {global
          ? 'Everyone has access. Selected grants are saved.'
          : 'Only selected users and group members have access.'}{' '}
        Admins retain access.
      </p>
      {open && audience && (
        <AudienceEditor
          {...props}
          audience={audience}
          onClose={() => setOpen(false)}
          onSaved={(saved) => {
            onSaved(saved);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
};
export default FeatureAudienceControls;
