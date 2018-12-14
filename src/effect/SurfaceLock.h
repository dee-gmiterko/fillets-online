#ifndef HEADER_SURFACELOCK_H
#define HEADER_SURFACELOCK_H

#include "NoCopy.h"

#include "/home/ienze/git/emsdk/emscripten/1.38.16/system/include/SDL/SDL.h"

/**
 * Lock and unlock surface.
 */
class SurfaceLock : public NoCopy {
    private:
        SDL_Surface *m_surface;
    public:
        SurfaceLock(SDL_Surface *surface);
        virtual ~SurfaceLock();
};

#endif
