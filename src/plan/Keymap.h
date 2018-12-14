#ifndef HEADER_KEYMAP_H
#define HEADER_KEYMAP_H

#include "KeyStroke.h"
#include "KeyDesc.h"

#include "/home/ienze/git/emsdk/emscripten/1.38.16/system/include/SDL/SDL.h"
#include <string>
#include <map>

/**
 * Table of defined keys.
 */
class Keymap {
    private:
        typedef std::map<KeyStroke,KeyDesc,stroke_less> t_keys;
        t_keys m_keys;
    public:
        void registerKey(const KeyStroke &stroke, const KeyDesc &desc);
        int indexPressed(const KeyStroke &stroke) const;
};

#endif
