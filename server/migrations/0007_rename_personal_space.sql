-- There are only ever two spaces and they're chosen from a header toggle, so
-- the personal one reads better as "My Notes" sitting opposite "Shared Notes".
UPDATE spaces SET name = 'My Notes' WHERE kind = 'personal' AND name = 'Notes';
