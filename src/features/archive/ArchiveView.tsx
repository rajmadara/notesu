import { ArchiveRestore, Box, Check, FolderOpen } from 'lucide-react'
import type { Item, Space, Task } from '../../lib/types'
import { archiveReason, byId, type ArchiveReason } from '../../lib/archive'
import { HeaderTitle } from '../shell/HeaderSlot'
import { EntityIcon } from '../workspace/EntityIcon'
import { DEFAULT_ITEM_ICON, DEFAULT_SPACE_ICON } from '../../lib/icons'

const NO_ITEM = -1
const NO_SPACE = -1

interface Props {
  tasks: Task[]
  items: Item[]
  spaces: Space[]
  onUnarchiveTask: (task: Task) => Promise<void>
  onUnarchiveItem: (item: Item) => Promise<void>
  onUnarchiveSpace: (space: Space) => Promise<void>
  onOpenItem: (itemId: number) => void
}

/**
 * The archive, laid out the way the sidebar is: space, then item, then tasks.
 * Nothing here has moved — a task keeps the item it was created under, and an
 * archived item or space hides its contents by inheritance. So a group's header
 * says which of the three was archived, and unarchiving acts at that level.
 */
export function ArchiveView({
  tasks,
  items,
  spaces,
  onUnarchiveTask,
  onUnarchiveItem,
  onUnarchiveSpace,
  onOpenItem,
}: Props) {
  const itemsById = byId(items)
  const spacesById = byId(spaces)

  // Every task that's out of the active lists, with the reason it's out.
  const archived: { task: Task; reason: Exclude<ArchiveReason, null> }[] = []
  for (const task of tasks) {
    const reason = archiveReason(task, itemsById, spacesById)
    if (reason) archived.push({ task, reason })
  }

  // An archived space or item belongs in the archive even with nothing in it.
  const spaceIds = new Set<number>(spaces.filter((s) => s.archived).map((s) => s.id))
  const itemIds = new Set<number>(items.filter((i) => i.archived).map((i) => i.id))
  for (const { task } of archived) {
    const item = task.item_id !== null ? itemsById.get(task.item_id) : undefined
    spaceIds.add(item ? item.space_id : NO_SPACE)
    if (item) itemIds.add(item.id)
  }
  for (const id of itemIds) {
    const item = itemsById.get(id)
    if (item) spaceIds.add(item.space_id)
  }

  if (spaceIds.size === 0) {
    return (
      <div className="task-page">
        <HeaderTitle>
          <h1 className="header-title">Archived</h1>
        </HeaderTitle>
        <p className="empty-state">
          Nothing archived. Finished tasks move here a week after you tick them.
        </p>
      </div>
    )
  }

  // Archived spaces last: they're the coldest thing in here.
  const orderedSpaces = [...spaceIds].sort((a, b) => {
    const sa = spacesById.get(a)
    const sb = spacesById.get(b)
    if (!!sa?.archived !== !!sb?.archived) return sa?.archived ? 1 : -1
    return (sa?.name ?? 'Not in a space').localeCompare(sb?.name ?? 'Not in a space')
  })
  const total = archived.length

  return (
    <div className="task-page">
      <HeaderTitle>
        <span className="header-title-group">
          <h1 className="header-title">Archived</h1>
          {total > 0 && (
            <span className="header-sub">
              {total} {total === 1 ? 'task' : 'tasks'}
            </span>
          )}
        </span>
      </HeaderTitle>

      {orderedSpaces.map((spaceId) => {
        const space = spacesById.get(spaceId)
        const spaceItemIds = [...itemIds].filter(
          (id) => itemsById.get(id)?.space_id === spaceId,
        )
        const loose = archived.filter(
          ({ task }) => task.item_id === null && spaceId === NO_SPACE,
        )
        const groups: number[] = [...spaceItemIds]
        if (loose.length > 0) groups.push(NO_ITEM)

        return (
          <section key={spaceId} className="archive-space">
            <div className="archive-space__head">
              <h2 className="section-title">
                {space ? (
                  <>
                    <EntityIcon icon={space.icon} fallback={DEFAULT_SPACE_ICON} size={16} />
                    {space.name}
                  </>
                ) : (
                  <>
                    <FolderOpen size={15} /> Not in a space
                  </>
                )}
              </h2>
              {space?.archived && (
                <>
                  <span className="archive-badge">Space archived</span>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => onUnarchiveSpace(space)}
                  >
                    <ArchiveRestore size={13} /> Restore space
                  </button>
                </>
              )}
            </div>

            {groups.map((itemId) => {
              const item = itemId === NO_ITEM ? undefined : itemsById.get(itemId)
              const rows =
                itemId === NO_ITEM
                  ? loose
                  : archived.filter(({ task }) => task.item_id === itemId)
              return (
                <div key={itemId} className="archive-item">
                  <div className="archive-item__head">
                    {item ? (
                      <button
                        type="button"
                        className="archive-item__name"
                        onClick={() => onOpenItem(item.id)}
                      >
                        <EntityIcon icon={item.icon} fallback={DEFAULT_ITEM_ICON} size={14} />
                        {item.name}
                      </button>
                    ) : (
                      <span className="archive-item__name archive-item__name--plain">
                        <Box size={14} /> Loose tasks
                      </span>
                    )}
                    <span className="archive-item__count">
                      {rows.length} {rows.length === 1 ? 'task' : 'tasks'}
                    </span>
                    {item?.archived && (
                      <>
                        <span className="archive-badge">Item archived</span>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => onUnarchiveItem(item)}
                        >
                          <ArchiveRestore size={13} /> Restore
                        </button>
                      </>
                    )}
                  </div>

                  {rows.length === 0 ? (
                    <p className="empty-state empty-state--tight">No archived tasks in here.</p>
                  ) : (
                    <ul className="checklist">
                      {rows.map(({ task, reason }) => (
                        <li
                          key={task.id}
                          className={`check-item${task.status === 'done' ? ' is-done' : ''}`}
                        >
                          <span className="check-row__box check-row__box--static" aria-hidden="true">
                            {task.status === 'done' && <Check size={12} strokeWidth={3} />}
                          </span>
                          <span className="check-item__text">{task.title}</span>
                          {/* Only a task archived in its own right can be put
                              back on its own; the others follow their parent. */}
                          {reason === 'task' ? (
                            <button
                              type="button"
                              className="icon-btn icon-btn--xs"
                              onClick={() => onUnarchiveTask(task)}
                              title="Put back on the list"
                              aria-label={`Unarchive ${task.title}`}
                            >
                              <ArchiveRestore size={13} />
                            </button>
                          ) : (
                            <span className="archive-inherited">
                              with {reason}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
