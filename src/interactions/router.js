// Tiny hash router:  #/          -> landing
//                    #/<topic>   -> topic panel
//                    #/play      -> ball game (any topic with isGame: true)
export function createRouter(topics, { onLanding, onTopic, onGame }) {
  function route() {
    const id = location.hash.replace(/^#\/?/, '');
    const topic = topics.find((t) => t.id === id);
    if (!topic) onLanding();
    else if (topic.isGame) onGame(topic);
    else onTopic(topic);
  }
  addEventListener('hashchange', route);
  return { route };
}
