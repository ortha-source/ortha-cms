import axios from 'axios';

describe('server', () => {
    it('boots with no plugin routes registered (404 on unknown path)', async () => {
        const res = await axios.get(`/api`, { validateStatus: () => true });

        expect(res.status).toBe(404);
    });
});
