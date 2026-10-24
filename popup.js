document.addEventListener('DOMContentLoaded', () => {
  render();
  document.getElementById('manageBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());
  document.getElementById('signOutBtn').addEventListener('click', async () => {
    await PrivexAccounts.signOut();
    render();
  });
  chrome.storage.onChanged.addListener(() => render());
});

async function render() {
  const [session, accounts] = await Promise.all([PrivexAccounts.getSession(), PrivexAccounts.listAccounts()]);
  const accountCount = Object.keys(accounts).length;
  const who = document.getElementById('who');
  const sub = document.getElementById('whoSub');

  document.getElementById('accountCount').textContent = accountCount;
  document.getElementById('accountLabel').textContent = accountCount === 1 ? 'account on this browser' : 'accounts on this browser';
  document.getElementById('signOutBtn').hidden = !session;
  document.getElementById('stats').hidden = accountCount === 0;

  if (session) {
    who.textContent = `Signed in as ${session.username}`;
    const tag = document.createElement('code');
    tag.textContent = `[${session.tag}:EMAIL_1]`;
    sub.replaceChildren('Your placeholders look like ', tag, '. Only yours are shown as real values in chats.');
    const saved = await PrivexAccounts.countEntries(session.userId);
    document.getElementById('savedCount').textContent = saved;
    document.getElementById('savedLabel').textContent = saved === 1 ? 'saved value' : 'saved values';
    document.getElementById('manageBtn').textContent = 'Open saved data';
  } else {
    who.textContent = accountCount ? 'Not signed in' : 'No Privex account yet';
    sub.textContent = 'Privex still masks what you send, but nothing is saved and chats keep showing placeholders.';
    document.getElementById('savedCount').textContent = '—';
    document.getElementById('manageBtn').textContent = accountCount ? 'Sign in' : 'Create account';
  }
}
